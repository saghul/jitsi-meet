import { JitsiConferenceEvents } from '../lib-jitsi-meet';
import {
    dominantSpeakerChanged,
    getLocalParticipant,
    participantConnectionStatusChanged,
    participantJoined,
    participantLeft,
    participantRoleChanged,
    participantUpdated
} from '../participants';
import { trackAdded, trackRemoved } from '../tracks';

import {
    CONFERENCE_FAILED,
    CONFERENCE_JOINED,
    CONFERENCE_LEFT,
    CONFERENCE_WILL_JOIN,
    CONFERENCE_WILL_LEAVE,
    LOCK_STATE_CHANGED,
    SET_AUDIO_ONLY,
    SET_LARGE_VIDEO_HD_STATUS,
    SET_LASTN,
    SET_PASSWORD,
    SET_PASSWORD_FAILED,
    SET_ROOM
} from './actionTypes';
import {
    AVATAR_ID_COMMAND,
    AVATAR_URL_COMMAND,
    EMAIL_COMMAND,
    JITSI_CONFERENCE_URL_KEY
} from './constants';
import { _addLocalTracksToConference } from './functions';

import type { Dispatch } from 'redux';

/**
 * Adds conference (event) listeners.
 *
 * @param {JitsiConference} conference - The JitsiConference instance.
 * @param {Dispatch} dispatch - The Redux dispatch function.
 * @private
 * @returns {void}
 */
function _addConferenceListeners(conference, dispatch) {
    // Dispatches into features/base/conference follow:

    conference.on(
        JitsiConferenceEvents.CONFERENCE_FAILED,
        (...args) => dispatch(conferenceFailed(conference, ...args)));
    conference.on(
        JitsiConferenceEvents.CONFERENCE_JOINED,
        (...args) => dispatch(conferenceJoined(conference, ...args)));
    conference.on(
        JitsiConferenceEvents.CONFERENCE_LEFT,
        (...args) => dispatch(conferenceLeft(conference, ...args)));

    conference.on(
        JitsiConferenceEvents.LOCK_STATE_CHANGED,
        (...args) => dispatch(lockStateChanged(conference, ...args)));

    // Dispatches into features/base/tracks follow:

    conference.on(
        JitsiConferenceEvents.TRACK_ADDED,
        t => t && !t.isLocal() && dispatch(trackAdded(t)));
    conference.on(
        JitsiConferenceEvents.TRACK_REMOVED,
        t => t && !t.isLocal() && dispatch(trackRemoved(t)));

    // Dispatches into features/base/participants follow:

    conference.on(
        JitsiConferenceEvents.DOMINANT_SPEAKER_CHANGED,
        (...args) => dispatch(dominantSpeakerChanged(...args)));

    conference.on(
        JitsiConferenceEvents.PARTICIPANT_CONN_STATUS_CHANGED,
        (...args) => dispatch(participantConnectionStatusChanged(...args)));

    conference.on(
        JitsiConferenceEvents.USER_JOINED,
        (id, user) => dispatch(participantJoined({
            id,
            name: user.getDisplayName(),
            role: user.getRole()
        })));
    conference.on(
        JitsiConferenceEvents.USER_LEFT,
        (...args) => dispatch(participantLeft(...args)));
    conference.on(
        JitsiConferenceEvents.USER_ROLE_CHANGED,
        (...args) => dispatch(participantRoleChanged(...args)));

    conference.addCommandListener(
        AVATAR_ID_COMMAND,
        (data, id) => dispatch(participantUpdated({
            id,
            avatarID: data.value
        })));
    conference.addCommandListener(
        AVATAR_URL_COMMAND,
        (data, id) => dispatch(participantUpdated({
            id,
            avatarURL: data.value
        })));
    conference.addCommandListener(
        EMAIL_COMMAND,
        (data, id) => dispatch(participantUpdated({
            id,
            email: data.value
        })));
}

/**
 * Sets the data for the local participant to the conference.
 *
 * @param {JitsiConference} conference - The JitsiConference instance.
 * @param {Object} state - The Redux state.
 * @returns {void}
 */
function _setLocalParticipantData(conference, state) {
    const { avatarID } = getLocalParticipant(state);

    conference.removeCommand(AVATAR_ID_COMMAND);
    conference.sendCommand(AVATAR_ID_COMMAND, {
        value: avatarID
    });
}

/**
 * Signals that a specific conference has failed.
 *
 * @param {JitsiConference} conference - The JitsiConference that has failed.
 * @param {string} error - The error describing/detailing the cause of the
 * failure.
 * @returns {{
 *     type: CONFERENCE_FAILED,
 *     conference: JitsiConference,
 *     error: string
 * }}
 * @public
 */
export function conferenceFailed(conference, error) {
    return {
        type: CONFERENCE_FAILED,
        conference,
        error
    };
}

/**
 * Attach any pre-existing local media to the conference once the conference has
 * been joined.
 *
 * @param {JitsiConference} conference - The JitsiConference instance which was
 * joined by the local participant.
 * @returns {Function}
 */
export function conferenceJoined(conference) {
    return (dispatch, getState) => {
        const localTracks
            = getState()['features/base/tracks']
                .filter(t => t.local)
                .map(t => t.jitsiTrack);

        if (localTracks.length) {
            _addLocalTracksToConference(conference, localTracks);
        }

        dispatch({
            type: CONFERENCE_JOINED,
            conference
        });
    };
}

/**
 * Signals that a specific conference has been left.
 *
 * @param {JitsiConference} conference - The JitsiConference instance which was
 * left by the local participant.
 * @returns {{
 *     type: CONFERENCE_LEFT,
 *     conference: JitsiConference
 * }}
 */
export function conferenceLeft(conference) {
    return {
        type: CONFERENCE_LEFT,
        conference
    };
}

/**
 * Signals the intention of the application to have the local participant join a
 * specific conference. Similar in fashion to {@code CONFERENCE_JOINED}.
 *
 * @param {JitsiConference} conference - The JitsiConference instance the
 * local participant will (try to) join.
 * @returns {{
 *     type: CONFERENCE_WILL_JOIN,
 *     conference: JitsiConference
 * }}
 */
function _conferenceWillJoin(conference) {
    return {
        type: CONFERENCE_WILL_JOIN,
        conference
    };
}

/**
 * Signals the intention of the application to have the local participant leave
 * a specific conference. Similar in fashion to CONFERENCE_LEFT. Contrary to it
 * though, it's not guaranteed because CONFERENCE_LEFT may be triggered by
 * lib-jitsi-meet and not the application.
 *
 * @param {JitsiConference} conference - The JitsiConference instance which will
 * be left by the local participant.
 * @returns {{
 *     type: CONFERENCE_LEFT,
 *     conference: JitsiConference
 * }}
 */
export function conferenceWillLeave(conference) {
    return {
        type: CONFERENCE_WILL_LEAVE,
        conference
    };
}

/**
 * Initializes a new conference.
 *
 * @returns {Function}
 */
export function createConference() {
    return (dispatch, getState) => {
        const state = getState();
        const { connection, locationURL } = state['features/base/connection'];

        if (!connection) {
            throw new Error('Cannot create a conference without a connection!');
        }

        const { password, room } = state['features/base/conference'];

        if (!room) {
            throw new Error('Cannot join a conference without a room name!');
        }

        const conference
            = connection.initJitsiConference(

                // XXX Lib-jitsi-meet does not accept uppercase letters.
                room.toLowerCase(),
                state['features/base/config']);

        conference[JITSI_CONFERENCE_URL_KEY] = locationURL;
        dispatch(_conferenceWillJoin(conference));

        _addConferenceListeners(conference, dispatch);

        _setLocalParticipantData(conference, state);

        conference.join(password);
    };
}

/**
 * Signals that the lock state of a specific JitsiConference changed.
 *
 * @param {JitsiConference} conference - The JitsiConference which had its lock
 * state changed.
 * @param {boolean} locked - If the specified conference became locked, true;
 * otherwise, false.
 * @returns {{
 *     type: LOCK_STATE_CHANGED,
 *     conference: JitsiConference,
 *     locked: boolean
 * }}
 */
export function lockStateChanged(conference, locked) {
    return {
        type: LOCK_STATE_CHANGED,
        conference,
        locked
    };
}

/**
 * Sets the audio-only flag for the current JitsiConference.
 *
 * @param {boolean} audioOnly - True if the conference should be audio only;
 * false, otherwise.
 * @returns {{
 *     type: SET_AUDIO_ONLY,
 *     audioOnly: boolean
 * }}
 */
export function setAudioOnly(audioOnly) {
    return {
        type: SET_AUDIO_ONLY,
        audioOnly
    };
}

/**
 * Action to set whether or not the currently displayed large video is in
 * high-definition.
 *
 * @param {boolean} isLargeVideoHD - True if the large video is high-definition.
 * @returns {{
 *     type: SET_LARGE_VIDEO_HD_STATUS,
 *     isLargeVideoHD: boolean
 * }}
 */
export function setLargeVideoHDStatus(isLargeVideoHD) {
    return {
        type: SET_LARGE_VIDEO_HD_STATUS,
        isLargeVideoHD
    };
}

/**
 * Sets the video channel's last N (value) of the current conference. A value of
 * undefined shall be used to reset it to the default value.
 *
 * @param {(number|undefined)} lastN - The last N value to be set.
 * @returns {Function}
 */
export function setLastN(lastN: ?number) {
    return (dispatch: Dispatch<*>, getState: Function) => {
        if (typeof lastN === 'undefined') {
            const config = getState()['features/base/config'];

            /* eslint-disable no-param-reassign */

            lastN = config.channelLastN;
            if (typeof lastN === 'undefined') {
                lastN = -1;
            }

            /* eslint-enable no-param-reassign */
        }

        dispatch({
            type: SET_LASTN,
            lastN
        });
    };
}

/**
 * Sets the password to join or lock a specific JitsiConference.
 *
 * @param {JitsiConference} conference - The JitsiConference which requires a
 * password to join or is to be locked with the specified password.
 * @param {Function} method - The JitsiConference method of password protection
 * such as join or lock.
 * @param {string} password - The password with which the specified conference
 * is to be joined or locked.
 * @returns {Function}
 */
export function setPassword(conference, method, password) {
    return (dispatch, getState) => {
        switch (method) {
        case conference.join: {
            let state = getState()['features/base/conference'];

            // Make sure that the action will set a password for a conference
            // that the application wants joined.
            if (state.passwordRequired === conference) {
                dispatch({
                    type: SET_PASSWORD,
                    conference,
                    method,
                    password
                });

                // Join the conference with the newly-set password.

                // Make sure that the action did set the password.
                state = getState()['features/base/conference'];
                if (state.password === password
                        && !state.passwordRequired

                        // Make sure that the application still wants the
                        // conference joined.
                        && !state.conference) {
                    method.call(conference, password);
                }
            }
            break;
        }

        case conference.lock: {
            const state = getState()['features/base/conference'];

            if (state.conference === conference) {
                return (
                    method.call(conference, password)
                        .then(() => dispatch({
                            type: SET_PASSWORD,
                            conference,
                            method,
                            password
                        }))
                        .catch(error => dispatch({
                            type: SET_PASSWORD_FAILED,
                            error
                        }))
                );
            }

            return Promise.reject();
        }
        }
    };
}

/**
 * Sets (the name of) the room of the conference to be joined.
 *
 * @param {(string|undefined)} room - The name of the room of the conference to
 * be joined.
 * @returns {{
 *     type: SET_ROOM,
 *     room: string
 * }}
 */
export function setRoom(room) {
    return {
        type: SET_ROOM,
        room
    };
}

/**
 * Toggles the audio-only flag for the current JitsiConference.
 *
 * @returns {Function}
 */
export function toggleAudioOnly() {
    return (dispatch: Dispatch<*>, getState: Function) => {
        const { audioOnly } = getState()['features/base/conference'];

        return dispatch(setAudioOnly(!audioOnly));
    };
}
