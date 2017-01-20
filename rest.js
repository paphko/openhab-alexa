/**
 * Copyright (c) 2014-2016 by the respective copyright holders.
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 */
 
var https = require('https');
var config = require('./config');
var utils = require('./utils.js');

/**
 * Returns all items
 */
function getItems(token, success, failure) {
    return getItem(token, null, success, failure);
}

/**
 * Returns a single item or group or all items, if itemName = null
 */
function getItem(token, itemName, success, failure) {
    var options = httpItemOptions(token, itemName);
    // DEBUG
    utils.log("GET", "https://" + options.hostname + ":" + options.port + options.path);

    https.get(options, function (response) {
            if (response.statusCode != 200) {
                failure({
                    message: "Error response " + response.statusCode
                });
                return;
            }
            var body = '';
            response.on('data', function (data) {
                body += data.toString('utf-8');
            });
            response.on('end', function () {
                var resp = JSON.parse(body);
                success(resp);
            });
            response.on("error", function (e) {
                utils.log("OPENHAB ERROR: " + e.message);
                failure(e);
            });
        })
        .end();
}

/**
 * POST a command to an item
 */
function postItemCommand(token, itemName, value, success, failure) {
    var options = httpItemOptions(token, itemName, 'POST', value.length);

    // DEBUG
    utils.log("POST", "https://" + options.hostname + ":" + options.port + options.path + " value " + value);

    var req = https.request(options, function (response) {
        var body = '';
        if (response.statusCode == 200 || response.statusCode == 201) {
            success(response);
        } else {
            failure({
                message: "Error response " + response.statusCode
            });
        }
        response.on("error", function (e) {
            utils.log("OPENHAB ERROR", e.message);
            failure(e);
        });
    });

    req.write(value);
    req.end();
}

/**
 * Returns a http option object suitable for item commands
 */
function httpItemOptions(token, itemname, method, length) {
    var options = {
        hostname: config.host,
        port: config.port,
        // OH1 required 'type=json', OH2 returns json by default (but type parameter doesn't hurt)
        path: config.path + (itemname || "") + (config.ohVersion === 1 ? '?type=json' : ''),
        method: method || 'GET',
        rejectUnauthorized: config.allowSelfSignedCerts !== true,
        headers: {}
    };

    if (config.userpass) {
        options.auth = config.userpass;
    } else {
        options.headers['Authorization'] = "Bearer " + token;
    }

    if (itemname === null && config.ohVersion === 1) {
        options.path = config.path + '?type=json';
    }

    if (method === 'POST' || method === 'PUT') {
        options.headers['Content-Type'] = 'text/plain';
        options.headers['Content-Length'] = length;
    }
    return options;
}

///**
// * Determines the openHAB version of a server
// * 
// * TODO: I hope we don't need this! All functionality should be run if possible, and ignored if it's not (e.g. because
// * it is not support in OH1, like tags).
// */
//function getOpenhabVersion(token, cb) {
//    var options = {
//        hostname: config.host,
//        port: config.port,
//        path: config.path.replace("items", "bindings"),
//        method: 'GET',
//        rejectUnauthorized: config.allowSelfSignedCerts !== true,
//        headers: {}
//    };
//
//    if (config.userpass) {
//        options.auth = config.userpass;
//    } else {
//        options.headers['Authorization'] = "Bearer " + token;
//    }
//
//    // DEBUG
//    utils.log("getOpenhabVersion", options.hostname + ":" + options.port + options.path);
//
//    https.get(options, function (response) {
//        utils.log("getOpenhabVersion", "statusCode " + response.statusCode);
//        switch (response.statusCode) {
//        case 200:
//            cb(2); // /rest/bindings exists only in OH2
//            break;
//        case 404:
//            cb(1); // OH1 should respond with a 'not found' code 404
//            break;
//        default:
//            cb(0); // anything else...
//            break;
//        }
//        response.on("error", function (e) {
//            utils.log("OPENHAB ERROR: " + e.message);
//            cb(0);
//        });
//    }).end();
//}

module.exports.getItems = getItems;
module.exports.getItem = getItem;
module.exports.postItemCommand = postItemCommand;
//module.exports.getOpenhabVersion = getOpenhabVersion;
