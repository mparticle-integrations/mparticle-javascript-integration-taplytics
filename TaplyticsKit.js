/* eslint-disable no-undef */

//
//  Copyright 2018 mParticle, Inc.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.

(function (window) {
    var name = 'Taplytics',
        MessageType = {
            SessionStart: 1,
            SessionEnd: 2,
            PageView: 3,
            PageEvent: 4,
            CrashReport: 5,
            OptOut: 6,
            Commerce: 16
        };

    var constructor = function () {
        var self = this,
            isInitialized = false,
            reportingService,
            eventQueue = [],
            settings = {},
            initUserAttributes = {},
            initUserIdentities = [];

        self.name = name;

        // ****** Fill out initForwarder to load your SDK ******
        // Note that not all arguments may apply to your SDK initialization.
        // These are passed from mParticle, but leave them even if they are not
        // being used.
        function initForwarder(forwarderSettings, service, testMode, trackerId, userAttributes, userIdentities) {
            // forwarderSettings contain settings from the mParticle server that
            // include any special filters or options that are enabled by our
            // customers in mParticle's UI for each SDK kit
            // service is a function used by mParticle's SDK. Keep it wherever you
            // see it in this template

            // userAttributes example: {gender: 'male', age: 25}

            // userIdentities example: { 1: 'customerId', 2: 'facebookId', 7: 'emailid@email.com' }
            // additional identityTypes can be found at https://github.com/mParticle/mparticle-sdk-javascript/blob/master-v2/src/types.js#L88-L101
            // can ignore service, testMode, trackerId
            reportingService = service;
            settings = forwarderSettings;
            initUserAttributes = userAttributes;
            initUserIdentities = userIdentities;

            try {
                // testmode is run from your test file, when testing, your
                // script will not be loaded, but rather the stubs you create in
                // the test file will be used
                if (!testMode) {
                    var taplyticsScript = document.createElement('script');
                    taplyticsScript.type = 'text/javascript';
                    taplyticsScript.async = true;
                    taplyticsScript.src = getTaplyticsSourceLink();
                    (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(taplyticsScript);
                    taplyticsScript.onload = function() {
                        isInitialized = true;

                        // On load, if the clientsdk exists and there are events
                        // in the eventQueue, process each event
                        // If your SDK queues its own methods, the following
                        // code block is not necessary and instances of
                        // eventQueue and isIniatialized can be removed
                        if (clientSdk && eventQueue.length > 0) {
                            // Process any events that may have been queued up
                            // while forwarder was being initialized.
                            for (var i = 0; i < eventQueue.length; i++) {
                                processEvent(eventQueue[i]);
                            }

                            eventQueue = [];
                        }
                    };
                }
                else {
                    isInitialized = true;
                }

                return 'Taplytics successfully loaded';
            }
            catch (e) {
                return 'Failed to initialize: ' + e;
            }
        }

        // The processEvent function can be tweaked based on the types of events
        // you want to process and how you want to map them to event logging from
        // your SDK.
        // This method provides the plumbing to route the events to logPageView,
        // logPurchaseEvent, logEvent, where you can call your SDK methods directly.
        function processEvent(event) {
            var reportEvent = false;
            if (isInitialized) {
                try {
                    if (event.EventDataType === MessageType.PageView) {
                        reportEvent = logPageView(event);
                    } else if (event.EventDataType === MessageType.Commerce && event.EventCategory === mParticle.CommerceEventType.ProductPurchase) {
                        reportEvent = logPurchaseEvent(event);
                    } else if (event.EventDataType === MessageType.PageEvent) {
                        reportEvent = logEvent(event);
                    }

                    // leave the below alone
                    if (reportEvent === true && reportingService) {
                        reportingService(self, event);
                        return 'Successfully sent to ' + name;
                    } else {
                        return 'Error logging event or event type not supported - ' + reportEvent.error;
                    }
                }
                catch (e) {
                    return 'Failed to send to: ' + name + ' ' + e;
                }
            }
            else {
                eventQueue.push(event);
            }

            return 'Can\'t send to forwarder ' + name + ', not initialized. Event added to queue.';
        }

        function getTaplyticsSourceLink() {
            var token = settings.jsToken;
            var cookieDomain = settings.cookieDomain;
            var timeout = settings.timeout;

            var src = 'https://js.taplytics.com/jssdk/' + token + '.min.js';
            var query = ''

            if (timeout) {
                query = query + 'timeout=' + timeout;
            } 

            if (cookieDomain) {
                src = src + (query ? '&' : '') + 'cookieDomain=' + cookieDomain;
            }

            var user_attributes = initUserAttributes;

            if (initUserIdentities.length) {
                var identity = initUserIdentities[0];
                var type = identity.Type;
                var id = identity.Identity;
                switch (type) {
                    case 1:
                        user_attributes["user_id"] = id;
                        break;
                    case 7:
                        user_attributes["email"] = id;
                        break;
                }
            }

            userAttributes = encodeURIComponent(JSON.stringify(user_attributes));

            query = query + (query ? '&' : '') + 'user_attributes' + user_attributes;

            if (query) {
                src = src + '?' + query
            }

            return src;
        }

        // ****** Call your logPageView function here ****** //
        function logPageView(event) {
            // Details on the `event` object schema in the README
            try {
                if (event.EventAttributes) {
                    Taplytics.page(event.EventName, event.EventAttributes);
                }
                else {
                    Taplytics.track(event.EventName);
                }
                return true;
            }
            catch (e) {
                return {error: e};
            }
        }

        function mergeObjects(obj1, obj2) {
            var obj = {};
            for (var key in obj1) {
                obj[key] = obj1[key];
            }
            for (var key in obj2) {
                obj[key] = obj2[key];
            }
            return obj;
        }

        // ****** Call your eCommerce logPurchase function here ****** //
        function logPurchaseEvent(event) {
            var reportEvent = false;
            // The products purchased will be on the array event.ProductAction.ProductList
            if (event.ProductAction.ProductList) {
                try {
                    event.ProductAction.ProductList.forEach(function(product) {
                        // Details on the `product` object schema in the README
                        if (product.Attributes) {
                            Taplytics.track(product.Name, parseFloat(product.TotalAmount), mergeObjects(product.Attributes, product));
                        } else {
                            Taplytics.track(product.Name, parseFloat(product.TotalAmount), product)
                        }
                    });
                    return true;
                }
                catch (e) {
                    return {error: e};
                }
            }

            return reportEvent;
        }

        // ****** Call your generic log event function here ****** //
        // Details on the `event` object schema in the README
        function logEvent(event) {
            try {
                if (event.EventAttributes) {
                    Taplytics.track(event.EventName, event.EventAttributes);
                }
                else {
                    Taplytics.track(event.EventName);
                }
                return true;
            }
            catch (e) {
                return {error: e};
            }
        }

        // ****** Call your setUserIdentity function here ****** //
        function setUserIdentity(id, type) {
            if (isInitialized) {
                try {
                    // Some integrations have primary ids that they use
                    // (ie. CustomerId, or Email), you may have special methods
                    // to call for these. mParticle allows for several other
                    // types of userIds to be set. To view all user identity
                    // types, navigate to - https://github.com/mParticle/mparticle-sdk-javascript/blob/master-v2/src/types.js#L88-L101
                    if (type === window.mParticle.IdentityType.CustomerId) {
                        Taplytics.identify({
                            user_id: id
                        });
                    }
                    else if (type === window.mParticle.IdentityType.Email) {
                        Taplytics.identify({
                            email: id
                        });
                    }
                }
                catch (e) {
                    return 'Failed to call setUserIdentity on ' + name + ' ' + e;
                }
            }
            else {
                return 'Can\'t call setUserIdentity on forwarder ' + name + ', not initialized';
            }
        }

        // ****** Call your setUserAttribute function here ****** //
        function setUserAttribute(key, value) {
            if (isInitialized) {
                try {
                    var attributes = {};
                    attributes[key] = value;
                    Taplytics.identify(attributes);
                    return 'Successfully called setUserAttribute API on ' + name;
                }
                catch (e) {
                    return 'Failed to call SET setUserAttribute on ' + name + ' ' + e;
                }
            }
            else {
                return 'Can\'t call setUserAttribute on forwarder ' + name + ', not initialized';
            }
        }

        // ****** Call your removeUserAttribute function here ****** //
        // Your Sdk may have a direct method for removing a client attribute.
        // The example below shows removing an attribute by setting its value to null.
        function removeUserAttribute(key) {
            setUserAttribute(key, null);
        }

        this.init = initForwarder;
        this.process = processEvent;
        this.setUserIdentity = setUserIdentity;
        this.setUserAttribute = setUserAttribute;
        this.removeUserAttribute = removeUserAttribute;
    };

    if (!window || !window.mParticle || !window.mParticle.addForwarder) {
        return;
    }

    window.mParticle.addForwarder({
        name: name,
        constructor: constructor
    });
})(window);
