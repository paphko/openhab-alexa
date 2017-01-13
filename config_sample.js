/**
* Default options, copy to config.js for deployment
* host
*    REST https host
* port
*    REST https port
* path
*    Base URL path for openHAB items
* userpass
*    Optional username:password for the REST server
*    by default oauth2 tokens will be used for authentication, uncomment this
*    to use standard BASIC auth when talking directly to an openHAB server.
* ohVersion
*    Optional explicit indication of openHAB server version (1 or 2).
*    Default is version 2.
* allowSelfSignedCertificates
*    Optionally accept self-signed certificates when talking directly to an 
*    openHAB server.
* homekitTags
*    Optional flag whether or not homekit tags should be used to collect
*    items that should be used with Alexa. This only works with openHAB 2
*    because openHAB 1 does not support tags. Default is true.
* group
*    Optional item group of openHAB server whose items will be collected to
*    be used with Alexa. This works for both, openHAB 1 and openHAB 2.
**/
module.exports = {
    host: 'my.openhab.org',
    port: 443,
    path: '/rest/items/',
    //userpass: 'user@foo.com:Password1',

    // ohVersion: 2,
    // allowSelfSignedCerts: false,

    // homekitTags: true,
    // group: 'Alexa',
};
