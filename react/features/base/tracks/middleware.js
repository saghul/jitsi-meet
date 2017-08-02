/* @flow */

import {
    CAMERA_FACING_MODE,
    MEDIA_TYPE,
    SET_AUDIO_MUTED,
    SET_CAMERA_FACING_MODE,
    SET_VIDEO_MUTED,
    TOGGLE_CAMERA_FACING_MODE,
    toggleCameraFacingMode
} from '../media';
import { MiddlewareRegistry } from '../redux';

import { setTrackMuted } from './actions';
import { TRACK_ADDED, TRACK_REMOVED, TRACK_UPDATED } from './actionTypes';
import { getLocalTrack } from './functions';

declare var APP: Object;

/**
 * Middleware that captures LIB_DID_DISPOSE and LIB_DID_INIT actions and,
 * respectively, creates/destroys local media tracks. Also listens to
 * media-related actions and performs corresponding operations with tracks.
 *
 * @param {Store} store - The redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register(store => next => action => {
    switch (action.type) {
    case SET_AUDIO_MUTED:
        _setMuted(store, action, MEDIA_TYPE.AUDIO);
        break;

    case SET_CAMERA_FACING_MODE: {
        // XXX The camera facing mode of a MediaStreamTrack can be specified
        // only at initialization time and then it can only be toggled. So in
        // order to set the camera facing mode, one may destroy the track and
        // then initialize a new instance with the new camera facing mode. But
        // that is inefficient on mobile at least so the following relies on the
        // fact that there are 2 camera facing modes and merely toggles between
        // them to (hopefully) get the camera in the specified state.
        const localTrack = _getLocalTrack(store, MEDIA_TYPE.VIDEO);
        let jitsiTrack;

        if (localTrack
                && (jitsiTrack = localTrack.jitsiTrack)
                && jitsiTrack.getCameraFacingMode()
                    !== action.cameraFacingMode) {
            store.dispatch(toggleCameraFacingMode());
        }
        break;
    }

    case SET_VIDEO_MUTED:
        _setMuted(store, action, MEDIA_TYPE.VIDEO);
        break;

    case TOGGLE_CAMERA_FACING_MODE: {
        const localTrack = _getLocalTrack(store, MEDIA_TYPE.VIDEO);
        let jitsiTrack;

        if (localTrack && (jitsiTrack = localTrack.jitsiTrack)) {
            // XXX MediaStreamTrack._switchCamera is a custom function
            // implemented in react-native-webrtc for video which switches
            // between the cameras via a native WebRTC library implementation
            // without making any changes to the track.
            jitsiTrack._switchCamera();

            // Don't mirror the video of the back/environment-facing camera.
            const mirror
                = jitsiTrack.getCameraFacingMode() === CAMERA_FACING_MODE.USER;

            store.dispatch({
                type: TRACK_UPDATED,
                track: {
                    jitsiTrack,
                    mirror
                }
            });
        }
        break;
    }

    case TRACK_ADDED:
        // TODO Remove this middleware case once all UI interested in new tracks
        // being added are converted to react and listening for store changes.
        if (typeof APP !== 'undefined' && !action.track.local) {
            APP.UI.addRemoteStream(action.track.jitsiTrack);
        }
        break;

    case TRACK_REMOVED:
        // TODO Remove this middleware case once all UI interested in tracks
        // being removed are converted to react and listening for store changes.
        if (typeof APP !== 'undefined' && !action.track.local) {
            APP.UI.removeRemoteStream(action.track.jitsiTrack);
        }
        break;

    case TRACK_UPDATED:
        // TODO Remove the below calls to APP.UI once components interested in
        // track mute changes are moved into react.
        if (typeof APP !== 'undefined') {
            const { jitsiTrack } = action.track;
            const isMuted = jitsiTrack.isMuted();
            const participantID = jitsiTrack.getParticipantId();
            const isVideoTrack = jitsiTrack.isVideoTrack();

            if (jitsiTrack.isLocal()) {
                if (isVideoTrack) {
                    APP.conference.videoMuted = isMuted;
                } else {
                    APP.conference.audioMuted = isMuted;
                }
            }

            if (isVideoTrack) {
                APP.UI.setVideoMuted(participantID, isMuted);
                APP.UI.onPeerVideoTypeChanged(
                    participantID, jitsiTrack.videoType);
            } else {
                APP.UI.setAudioMuted(participantID, isMuted);
            }
        }

        break;
    }

    return next(action);
});

/**
 * Gets the local track associated with a specific <tt>MEDIA_TYPE</tt> in a
 * specific redux store.
 *
 * @param {Store} store - The redux store from which the local track associated
 * with the specified <tt>mediaType</tt> is to be retrieved.
 * @param {MEDIA_TYPE} mediaType - The <tt>MEDIA_TYPE</tt> of the local track to
 * be retrieved from the specified <tt>store</tt>.
 * @private
 * @returns {Track} The local <tt>Track</tt> associated with the specified
 * <tt>mediaType</tt> in the specified <tt>store</tt>.
 */
function _getLocalTrack(store, mediaType: MEDIA_TYPE) {
    return getLocalTrack(store.getState()['features/base/tracks'], mediaType);
}

/**
 * Mutes or unmutes a local track with a specific media type.
 *
 * @param {Store} store - The redux store in which the specified action is
 * dispatched.
 * @param {Action} action - The redux action dispatched in the specified store.
 * @param {MEDIA_TYPE} mediaType - The {@link MEDIA_TYPE} of the local track
 * which is being muted or unmuted.
 * @private
 * @returns {void}
 */
function _setMuted(store, { muted }, mediaType: MEDIA_TYPE) {
    const localTrack = _getLocalTrack(store, mediaType);

    localTrack && store.dispatch(setTrackMuted(localTrack.jitsiTrack, muted));
}
