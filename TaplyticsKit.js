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

        function initForwarder(forwarderSettings, service, testMode, trackerId, userAttributes, userIdentities) {
            reportingService = service;
            settings = forwarderSettings;
            initUserAttributes = userAttributes;
            initUserIdentities = userIdentities;

            try {
                if (!testMode && !window.Taplytics) {
                    var taplyticsScript = document.createElement('script');
                    taplyticsScript.type = 'text/javascript';
                    taplyticsScript.async = true;
                    taplyticsScript.src = getTaplyticsSourceLink();
                    (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(taplyticsScript);
                    taplyticsScript.onload = function() {
                        isInitialized = true;

                        // On load, if the clientsdk exists and there are events
                        // in the eventQueue, process each event
                        if (window.Taplytics && eventQueue.length > 0) {
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

        /**
         * Called whenever an event occurs. Used to log different types of events.
         * @param event
         * @returns {string}
         */
        function processEvent(event) {
            var reportEvent = false;
            if (isInitialized) {
                try {
                    if (event.EventDataType === MessageType.PageView) {
                        reportEvent = logPageView(event);
                    } else if (event.EventDataType === MessageType.Commerce) {
                        if (event.EventCategory === mParticle.CommerceEventType.ProductPurchase) {
                            reportEvent = logPurchaseEvent(event);
                        } else {
                            reportEvent = logCommerceEvent(event);
                        }
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

        /**
         * Helper method to check if object is empty
         * @param obj
         * @returns {boolean}
         */
        function isEmpty(obj) {
            for (var prop in obj) { return false; }
            return true;
        }

        /**
         * Helper method to merge obj 2 into obj1
         * @param obj1
         * @param obj2
         */
        function mergeObjects(obj1, obj2) {
            var obj = {};
            for (var key in obj1) {
                if (obj1[key]) {
                    obj[key] = obj1[key];
                }
            }
            for (var key in obj2) {
                if (obj2[key]) {
                    obj[key] = obj2[key];
                }
            }
            return obj;
        }

        /**
         * Construct Taplytics src link to load the SDK
         * @returns {string}
         */
        function getTaplyticsSourceLink() {
            var token = settings.apiKey;
            var cookieDomain = settings.taplyticsOptionCookieDomain;
            var timeout = settings.taplyticsOptionTimeout;

            var src = 'https://js.taplytics.com/jssdk/' + token + '.min.js';
            var query = '';

            if (timeout) {
                query = query + 'timeout=' + timeout;
            }

            if (cookieDomain) {
                query = query + (query ? '&' : '') + 'cookieDomain=' + cookieDomain;
            }

            var user_attributes = initUserAttributes || {};

            if (initUserIdentities.length) {
                var identity = initUserIdentities[0];
                var type = identity.Type;
                var id = identity.Identity;
                switch (type) {
                    case 1:
                        user_attributes['user_id'] = id;
                        break;
                    case 7:
                        user_attributes['email'] = id;
                        break;
                }
            }

            if (!isEmpty(user_attributes)) {
                user_attributes = encodeURIComponent(JSON.stringify(user_attributes));
                query = query + (query ? '&' : '') + 'user_attributes' + user_attributes;
            }

            if (query) {
                src = src + '?' + query;
            }

            return src;
        }

        /**
         * Logs page view event to Taplytics
         * @param event
         * @returns {*}
         */
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
                return { error: e };
            }
        }

        /**
         * Logs purchase events as revenue events to Taplytics
         * @param event
         * @returns {*}
         */
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
                            Taplytics.track(product.Name, parseFloat(product.TotalAmount), product);
                        }
                    });
                    return true;
                }
                catch (e) {
                    return { error: e };
                }
            }

            return reportEvent;
        }

        /**
         * Logs all other commerce events as regular events with metadata to Taplytics
         * @param event
         * @returns {*}
         */
        function logCommerceEvent(event) {
            var reportEvent = false;

            var attributes = {};

            if (event) {
                try {
                    switch (event.EventCategory) {
                        case mParticle.CommerceEventType.ProductAddToCart:
                            attributes['ShoppingCart'] = event.ShoppingCart;
                            break;
                        case mParticle.CommerceEventType.ProductRemoveFromCart:
                            attributes['ShoppingCart'] = event.ShoppingCart;
                            break;
                        case mParticle.CommerceEventType.PromotionClick:
                            attributes['PromotionList'] = event.PromotionAction.PromotionList;
                            break;
                        case mParticle.CommerceEventType.ProductImpression:
                            if (event.ProductImpressions && event.ProductImpressions.length) {
                                attributes['ProductImpressions'] = event.ProductImpressions;
                            }
                            break;
                    }

                    if (event.EventAttributes) {
                        attributes['EventAttributes'] = event.EventAttributes;
                    }

                    if (event.ProductAction) {
                        attributes['ProductAction'] = event.ProductAction;
                    }

                    if (event.CurrencyCode) {
                        attributes['CurrencyCode'] = event.CurrencyCode;
                    }

                    if (!isEmpty(attributes)) {
                        Taplytics.track(event.EventName, null, attributes);
                    } else {
                        Taplytics.track(event.EventName);
                    }
                    return true;
                }
                catch (e) {
                    return { error: e };
                }
            }

            return reportEvent;
        }

        /**
         * Log Regular events
         * @param event
         * @returns {*}
         */
        function logEvent(event) {
            try {
                if (event.EventAttributes) {
                    Taplytics.track(event.EventName, null, event.EventAttributes);
                }
                else {
                    Taplytics.track(event.EventName);
                }
                return true;
            }
            catch (e) {
                return { error: e };
            }
        }

        /**
         * Identifies user id or email with Taplytics
         * @param id
         * @param type
         * @returns {string}
         */
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

        /**
         * Sets user attributes to Taplytics
         * @param key
         * @param value
         * @returns {string}
         */
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

        /** 
         * Remove user attribute by setting it to null
         * @param key
         */
        function removeUserAttribute(key) {
            setUserAttribute(key, null);
        }

        /**
         * V2 version of setting user identity
         * @param user
         * @returns {string}
         */
        function onUserIdentified(user) {
            if (isInitialized) {
                var identities = user.getUserIdentities().userIdentities;
                var attributes = {};
                if (identities.customerid) {
                    attributes.user_id = identities.customerid;
                }
                if (identities.email) {
                    attributes.email = identities.email;
                }
                if (!isEmpty(attributes)) {
                    Taplytics.identify(attributes);
                }
            }
            else {
                return 'Can\'t call onUserIdentified on forwarder ' + name + ', not initialized';
            }
        }

        this.init = initForwarder;
        this.process = processEvent;
        this.setUserIdentity = setUserIdentity;
        this.setUserAttribute = setUserAttribute;
        this.removeUserAttribute = removeUserAttribute;
        this.onUserIdentified = onUserIdentified;
    };

    if (!window || !window.mParticle || !window.mParticle.addForwarder) {
        return;
    }

    window.mParticle.addForwarder({
        name: name,
        constructor: constructor
    });
})(window);