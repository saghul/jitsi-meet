/*
 * Copyright @ 2017-present Atlassian Pty Ltd
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#import <React/RCTBridge.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTLog.h>

#import <AVFoundation/AVFoundation.h>

@interface AudioMode : RCTEventEmitter
@end

@implementation AudioMode {
    NSString *_category;
    NSString *_mode;
}

RCT_EXPORT_MODULE();

typedef enum {
    kAudioModeDefault,
    kAudioModeAudioCall,
    kAudioModeVideoCall
} JitsiMeetAudioMode;

- (NSDictionary *)constantsToExport {
    return @{
        @"AUDIO_CALL" : [NSNumber numberWithInt: kAudioModeAudioCall],
        @"DEFAULT"    : [NSNumber numberWithInt: kAudioModeDefault],
        @"VIDEO_CALL" : [NSNumber numberWithInt: kAudioModeVideoCall]
    };
};

- (instancetype)init {
    self = [super init];
    if (self) {
        _category = nil;
        _mode = nil;

        // Add listener for audio route changes
        [[NSNotificationCenter defaultCenter]
             addObserver:self
                selector:@selector(routeChanged:)
                    name:AVAudioSessionRouteChangeNotification
                  object:nil];
    }
    return self;
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (dispatch_queue_t)methodQueue {
    // Make sure all our methods run in the main thread.  The route change
    // notification runs there so this will make sure it will only be fired
    // after our changes have been applied (when we cause them, that is).
    return dispatch_get_main_queue();
}

- (void)routeChanged:(NSNotification*)notification {
    NSInteger reason
        = [[notification.userInfo
                valueForKey:AVAudioSessionRouteChangeReasonKey]
            integerValue];

    switch (reason) {
    case AVAudioSessionRouteChangeReasonCategoryChange:
        // AVAudioSession is a singleton and other parts of the application such as
        // WebRTC may undo the settings. Make sure that the settings are reapplied
        // upon undoes.
        if (_category || _mode) {
            [self setCategory:_category mode:_mode error:nil];
        }
        break;

    default:
        // Do nothing.
        break;
    }

    // Send an event about the route change
    [self sendEventWithName:@"AudioRouteChanged" body:nil];
}

- (BOOL)setCategory:(NSString *)category
               mode:(NSString *)mode
              error:(NSError * _Nullable *)outError {
    AVAudioSession *session = [AVAudioSession sharedInstance];

    if (session.category != category
            && ![session setCategory:category error:outError]) {
        RCTLogError(@"Failed to (re)apply specified AVAudioSession category!");
        return NO;
    }

    if (session.mode != mode && ![session setMode:mode error:outError]) {
        RCTLogError(@"Failed to (re)apply specified AVAudioSession mode!");
        return NO;
    }

    return YES;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"AudioRouteChanged"];
}

RCT_EXPORT_METHOD(setMode:(int)mode
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject) {
    NSString *avCategory;
    NSString *avMode;
    NSError *error;

    switch (mode) {
    case kAudioModeAudioCall:
        avCategory = AVAudioSessionCategoryPlayAndRecord;
        avMode = AVAudioSessionModeVoiceChat;
        break;
    case kAudioModeDefault:
        avCategory = AVAudioSessionCategorySoloAmbient;
        avMode = AVAudioSessionModeDefault;
        break;
    case kAudioModeVideoCall:
        avCategory = AVAudioSessionCategoryPlayAndRecord;
        avMode = AVAudioSessionModeVideoChat;
        break;
    default:
        reject(@"setMode", @"Invalid mode", nil);
        return;
    }

    if (![self setCategory:avCategory mode:avMode error:&error] || error) {
        reject(@"setMode", error.localizedDescription, error);
        return;
    }

    // Save the desired/specified category and mode so that they may be
    // reapplied (upon undoes as described above).
    _category = avCategory;
    _mode = avMode;

    resolve(nil);
}

@end
