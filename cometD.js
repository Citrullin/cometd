exports.cometD = function () {
    var request = require('request'), zlib = require('zlib');
    var subscriber = [];
    var config = {
        token: false,
        url: ""
    };
    var jar = request.jar();
    var handshaked = false;
    var requestId = 1;

    var clientId = "";

    var stop = false;

    return {
        topic: "",
        errorMultiple: 0,
        errorTimeout: 0,
        debug: false,
        timeout: 10000,
        init: function (pluginConfig) {
            if (pluginConfig.debug) {
                console.log("[CometD] Initialized with config: " + JSON.stringify(pluginConfig) + '\n');
                this.debug = true;
            }
            config = pluginConfig;

            this.handshake();
        },
        connect: function () {
            if (!stop) {
                if(this.debug){
                    console.log('[' + this.topic + ']: Conneting...\n');
                }

                var message = {
                    channel: "/meta/connect",
                    clientId: clientId,
                    minimumVersion: "1.0",
                    version: "1.0",
                    id: requestId,
                    connectionType: "long-polling"
                };

                var headers = {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + config.token,
                    'Access-Control-Allow-Origin': '*',
                    "Accept-Language": "en-US,en;q=0.8,de;q=0.6",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Accept": "*/*"
                };

                function ConnectHandler() {
                    var self;
                    return {
                        notify: function (error, response, body) {
                            if(!error){
                                if (self.debug) {
                                    console.log('[Connect] [' + self.topic + '] Response: ' + JSON.stringify(body) + '\n');
                                }

                                if(!!body && !!body.length && body.reconnect == 'retry'){
                                    if(self.debug){
                                        console.log('[Connect] [' + self.topic + '] Got connect retry response. Reconnect...\n');
                                    }
                                    //Reconnect
                                    self.connect();
                                }
                                else if(
                                    response.statusCode === 408
                                ){
                                    self.errorTimeout++;

                                    if(self.errorTimeout > 10){
                                        if(self.debug){
                                            console.log('[Connect] [' + self.topic + '] Too many Timeout Errors. Reinitialize...\n')
                                        }

                                        self.reInitialization();
                                        self.stop();
                                    }else{
                                        if(self.debug){
                                            console.log('[Connect] [' + self.topic + '] Timeout. Reconnect...\n');
                                        }
                                        self.connect();
                                    }
                                }
                                else if(!!body && !!body.length){
                                    var nothing = true;
                                    for(var i = 0; i < body.length; i++){
                                        if(!!body[i].data){
                                            //Reconnect
                                            self.connect();
                                            //Set timeout Error to zero
                                            self.errorTimeout  = 0;
                                            self.errorMultiple = 0;

                                            if(self.debug){
                                                console.log(
                                                    '[Connect] [' + self.topic + ']' +
                                                    ' Got Streaming Data. ' +
                                                    'Notifying and Reconnecting...\n'
                                                );
                                            }
                                            self.notify(body[i].channel, body[i].data);
                                            nothing = false;
                                        }else if(
                                            !!body[i].advice &&
                                            !body[i].advice.successful &&
                                            body[i].advice.reconnect == 'handshake'
                                        ){
                                            if(self.debug){
                                                console.log(
                                                    '[Connect] [' + self.topic + '] ' +
                                                    'Got handshake retry response. ' +
                                                    'Handshaking...\n'
                                                );
                                            }
                                            self.reInitialization();
                                            self.stop();
                                            nothing = false;
                                        }else if(!!body[i].advice && !!body[i].advice['multiple-clients']){

                                            if(self.errorMultiple > 10){
                                                if(self.debug){
                                                    console.log(
                                                        '[Connect] [' + self.topic + '] ' +
                                                        'Got to many multiple clients response.' +
                                                        ' Reinitialization...\n'
                                                    );
                                                }

                                                self.reInitialization();
                                                self.stop();
                                            }else{
                                                //Reconnect
                                                self.connect();
                                                //Set timeout Error to zero
                                                self.errorTimeout = 0;
                                                //Set increment errorMultiple
                                                self.errorMultiple++;

                                                if(self.debug){
                                                    console.log('[Connect] [' + self.topic + '] Got multiple clients response. Reconnecting...\n');
                                                }
                                                self.timeout = body[i].advice.timeout;
                                            }
                                            nothing = false;
                                        } else if(!!body[i].advice){
                                            //Reconnect
                                            self.connect();
                                            //Set timeout Error to zero
                                            self.errorTimeout   = 0;
                                            self.errorMultiple  = 0;

                                            if(self.debug){
                                                if(self.timeout !== body[i].advice.timeout){
                                                    console.log('[Connect] [' + self.topic + '] Set a new timeout: ' + body[i].advice.timeout + '\n');
                                                }
                                            }
                                            self.timeout = body[i].advice.timeout;
                                            nothing = false;
                                        }
                                    }

                                    if(nothing){
                                        //Reconnect
                                        self.connect();
                                        //Set timeout Error to zero
                                        self.errorTimeout = 0;
                                    }
                                }else if(!response){
                                    //Reconnect
                                    self.connect();
                                    //Set timeout Error to zero
                                    self.errorTimeout   = 0;
                                    self.errorMultiple  = 0;

                                    if(self.debug){
                                        console.log('[Connect] [' + self.topic + '] Response: ' + response + '\n');
                                    }
                                    console.log('[Connect] [' + self.topic + '] Empty response. Reconnect...\n');
                                }else{
                                    if(self.debug){
                                        console.log('[Connect] [' + self.topic + '] Got an error. Reinitialize...\n');
                                    }
                                    self.reInitialization();
                                    self.stop();
                                }
                            }else if(error && error.code === 'ETIMEDOUT'){
                                    //Reconnect
                                    self.connect();

                                    if(self.debug){
                                        console.log('[Connect] [' + self.topic + '] Regular Timeout. Reconnect...\n');
                                    }
                            }
                        },
                        setSelf: function (object) {
                            self = object;
                        }
                    }
                }

                var handler = new ConnectHandler();
                handler.setSelf(this);


                request(
                    {
                        jar: jar,
                        timeout: this.timeout,
                        gzip: true,
                        url: config.url,
                        method: 'POST',
                        headers: headers,
                        json: message
                    },
                    handler.notify
                );
            }
        },
        handshake: function () {
            if (this.debug) {
                console.log('[Handshake] Send Handshake Request...\n');
            }
            var message =
            {
                channel: "/meta/handshake",
                minimumVersion: "1.0",
                version: "1.0",
                id: requestId,
                supportedConnectionTypes: ["long-polling"]
            };

            var headers = {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.token,
                'Access-Control-Allow-Origin': '*',
                "Accept-Language": "en-US,en;q=0.8,de;q=0.6",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Accept": "*/*"
            };

            function HandshakeHandler() {
                var self;
                return {
                    notify: function (error, response, body) {
                        if (self.debug) {
                            console.log('[Handshake] [' + self.topic + '] Response: ' + JSON.stringify(body) + '\n');
                        }

                        if(!body){
                            self.handshake();
                        }else if(!!body && !!body[0].successful && !!body[0].clientId){
                            clientId = body[0].clientId;
                            handshaked = true;
                            requestId++;
                            self.notify('/meta/handshake', body);
                            self.addEventListener('/meta/subscribe', function(){
                                self.connect();
                            });
                            self.subscribe();

                        }else{
                            self.handshake();
                        }
                    },
                    setSelf: function (object) {
                        self = object;
                    }
                }
            }

            var handler = new HandshakeHandler();
            handler.setSelf(this);

            request(
                {
                    jar: jar,
                    gzip: true,
                    url: config.url,
                    method: 'POST',
                    headers: headers,
                    json: message
                },
                handler.notify
            );
        },
        subscribe: function () {

            if(!stop){

                if (handshaked) {
                    if(config.debug){
                        console.log('[Subscription] [' + this.topic + '] Subscribe to channel ' + this.topic + '...');
                    }

                    var message =
                    {
                        channel: "/meta/subscribe",
                        clientId: clientId,
                        id: requestId,
                        subscription: this.topic
                    };

                    var headers = {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + config.token,
                        'Access-Control-Allow-Origin': '*',
                        "Accept-Language": "en-US,en;q=0.8,de;q=0.6",
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                        "Accept": "*/*"
                    };

                    function SubscribeHandler() {
                        var self;
                        return {
                            notify: function (error, response, body) {
                                if (config.debug) {
                                    console.log('[Subscription] [' + self.topic + '] Response: ' + JSON.stringify(body) + '\n');
                                }

                                if(!!body && body[0].successful){
                                    self.notify('/meta/subscribe', body);
                                    self.start();
                                }
                                else if (!body || !body[0].successful) {
                                    setTimeout(self.subscribe, 1000);
                                }
                                requestId++;
                            },
                            setSelf(object){
                                self = object;
                            }
                        }
                    }

                    var subscribeHandler = new SubscribeHandler();
                    subscribeHandler.setSelf(this);


                    request(
                        {
                            jar: jar,
                            gzip: true,
                            url: config.url,
                            method: 'POST',
                            headers: headers,
                            json: message
                        },
                        subscribeHandler.notify
                    );
                } else {
                    setTimeout(this.subscribe, 2000);
                }
            }
        },
        addEventListener: function (type, func) {
            subscriber.push([type, func]);
        },
        notify: function (topic, message) {
            if(config.debug){
                console.log('[Notify] Topic: ' + topic + ' Message: ' + JSON.stringify(message) + '\n');
            }
            for (var i = 0; i < subscriber.length; i++) {
                var current = subscriber[i];
                if(current[0] == topic){
                    current[1](topic, message);
                }
            }
        },
        stop: function () {
            stop = true;
        },
        start: function(){
            stop = false;
        },
        reInitialization: function(){
                function HandshakeListener(){
                    var self;
                    return {
                        setSelf: function(object){
                            self = object;
                        },
                        onEvent: function(){
                            self.subscribe(self.topic);
                        }
                    }
                }

                var handshakeListener = new HandshakeListener();
                handshakeListener.setSelf(this);

                this.addEventListener('/meta/handshake', handshakeListener.onEvent);
                this.handshake();
            }

    }
};
