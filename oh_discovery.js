/**
 * Copyright (c) 2014-2016 by the respective copyright holders.
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 */

/**
 * This class is responsible for discovering all Alexa items of the configured OH server.
 * OH version specific code (OH1 / OH2) is encapsulated in rest.js.
 * See config.js for configuration of discoverable items.
 */

var utils = require('./utils.js');
var rest = require('./rest.js');
var config = require('./config');
var homekitTags = require('./homekitTags');

function getItemsFromResponse(result) {
    if (!result) {
        return []; // result is not set, return empty array
    }
    // maybe it is already a list of items
    if (Object.prototype.toString.call(result) === '[object Array]') {
        var firstItem = result.slice(0, 1); // if it's an array, get first item to check whether it's an item
        if (firstItem && firstItem.name !== null) {
            return result; // first element of array seems to be an item, so we can return the array
        }
    }
    // if result.item is an array of items (http://stackoverflow.com/questions/4775722/check-if-object-is-array)
    if (result.item && Object.prototype.toString.call(result.item) === '[object Array]') {
        var firstItem = result.item.slice(0, 1); // if it's an array, get first item to check whether it's an item
        if (firstItem && firstItem.name !== null) {
            return result.item; // first element of array seems to be an item, so we can return the array
        }
    }
    // if result is a group item, return its members
    if (result.type === 'GroupItem' || result.type === "Group") {
        return result.members;
    }
    // no luck, return empty array
    utils.log("getItemFromResponse", "unexpected response: " + JSON.stringify(result).substring(0, 500));
    return [];
}

function getHomekitTag(item) {
    if (!item || !item.tags) {
        return null;
    }
    for (var tagNum in item.tags) {
        var tag = item.tags[tagNum];
        // supported tags as specified here: 
        if (homekitTags.allTags.indexOf(tag) >= 0) {
            return tag;
        }
    }
    return null;
}

function hasGroupName(item) {
    if (!item || !item.groupNames) {
        return false;
    }
    return item.groupNames.indexOf(config.group) >= 0;
}

function checkItemType(item, expectedType, tag, expectedTags) {
    if (item.type === "Group" && item.groupType !== expectedType) {
        return false;
    } else if (item.type !== (expectedType + "Item") && item.type !== expectedType) {
        return false;
    }
    if (tag === null || tag === undefined) {
        return true; // no homekit tag to check
    }
    return expectedTags.indexOf(tag) >= 0;
}

function getAlexaDevice(item) {
    var actions = null;
    var tag = getHomekitTag(item);
    var temperatureFormat = null;
    if (checkItemType(item, "Switch", tag, [homekitTags.Lighting, homekitTags.Switchable])) {
        actions = [
            "turnOn",
            "turnOff"
        ];
    } else if (checkItemType(item, "Dimmer", tag, [homekitTags.Lighting])) {
        actions = [
          "incrementPercentage",
          "decrementPercentage",
          "setPercentage",
          "turnOn",
          "turnOff"
        ];
    } else if (checkItemType(item, "Number", tag, [])) {
        actions = [
          "incrementPercentage",
          "decrementPercentage",
          "setPercentage"
        ];
    } else if (checkItemType(item, "Group", tag, [homekitTags.Thermostat])) {
        actions = [
            "incrementTargetTemperature",
            "decrementTargetTemperature",
            "setTargetTemperature"
        ];
        var formatIndex = item.tags.indexOf("Fahrenheit");
        temperatureFormat = formatIndex > -1 ? "fahrenheit" : "celsius";
    } else if (item.type === "GroupItem") {
        utils.log("discoverDevices", "group " + item.name + " found but ignoring for now...");
    }
    if (actions !== null) {
        // DEBUG
        utils.log("discoverDevices", "adding " + item.type + ": " + item.name);
        return {
            actions: actions,
            applianceId: item.name,
            manufacturerName: 'openHAB',
            modelName: tag === null ? item.type : tag, // use tag, if available; item type otherwise
            version: item.tags === undefined ? '1' : '2', // openhab version (only OH2 has tags)
            friendlyName: item.label ? item.label : item.name.replace(/_/g, ' '), // try to get a human readable name...
            friendlyDescription: item.type + ' "' + item.name + '" via openHAB',
            isReachable: true,
            additionalApplianceDetails: {
                temperatureFormat: temperatureFormat,
                itemType: item.type,
                itemTag: tag
            }
        };
    }
    return null;
}

/**
 * Get all items that are available on the OH server, depending on the config:
 * - If config.homekit does not exist or if config.homekit = true, then use homekit tags to collect items
 * - If config.group is set, collect all items in that group
 */
function getAlexaItems(token, success, failure) {
  var useTags = config.ohVersion !== 1 && (config.homekit === undefined || config.homekit === true);
  var group = (typeof config.group === 'string' || config.group instanceof String) ? config.group : null;

  if (useTags) {
      utils.log("getAlexaItems", "query server for homekit tags and group: " + group);
      // if tags are used, it is OH2 and group info is also available for each item
      var filterTags = function(result) {
          var items = getItemsFromResponse(result);
          utils.log("getAlexaItems.filterTags", items.length + " received items will be filtered...");
          var filteredItems = [];
          for (var itemNum in items) {
              var item = items[itemNum];
              if (getHomekitTag(item) !== null || hasGroupName(item)) {
                  filteredItems.push(item);
              }
          }
          utils.log("getAlexaItems.filterTags", filteredItems.length + " items with homekit tag and/or group: " + config.group);
          success(filteredItems);
      };
      rest.getItems(token, filterTags, failure);
  } else if (group !== null) {
      // get all items from the configured group
      rest.getItem(token, group, success, failure);
  } else {
      // report incompatible/incomplete config
      failure({
          message: "no compatible config found for getting Alexa items"
      });
  }
}

function discoverDevices(token, success, failure) {
    var devices = function (result) {
        //DEBUG
        //utils.log("discoverDevices", JSON.stringify(result)); // this spams log in case of huge response...
        //utils.log("discoverDevices", JSON.stringify(result).substring(0, 500)); // crop content to avoid huge log entries
        var items = getItemsFromResponse(result);
        utils.log("discoverDevices", items.length + " received items");

        var discoverdDevices = [];
        for (var itemNum in items) {
            var item = items[itemNum];
            // convert openhab item to alexa discovered device
            var discoveredDevice = getAlexaDevice(items[itemNum]);
            if (discoveredDevice !== null) {
                discoverdDevices.push(discoveredDevice);
            }
        }
        success(discoverdDevices);
    };

    getAlexaItems(token, devices, failure);
}

/**
 * This method is invoked when we receive a "Discovery" message from Alexa Smart Home Skill.
 * We are expected to respond back with a list of appliances that we have discovered for a given
 * customer.
 */
exports.handleDiscovery = function (event, context) {
    /**
     * Crafting the response header
     */
    var header = {
        messageId: event.header.messageId,
        name: event.header.name.replace("Request", "Response"),
        namespace: event.header.namespace,
        payloadVersion: event.header.payloadVersion
    };

    /**
     * Craft the final response back to Alexa Smart Home Skill. This will include all the
     * discoverd appliances.
     */

    discoverDevices(event.payload.accessToken, function (devices) {
        /**
         * Response body will be an array of discovered devices.
         */
        var payload = {
            discoveredAppliances: devices
        };
        var result = {
            header: header,
            payload: payload
        };

        // DEBUG
        // utils.log('Discovery', JSON.stringify(result));
        utils.log('Discovery', devices.length + ' devices discovered');

        context.succeed(result);
        },
        function (error) {
            context.done(null, utils.generateControlError(event.header.messageId, event.header.name, 'DependentServiceUnavailableError', error.message));
        }
    );
};
