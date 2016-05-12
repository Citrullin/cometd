##A Simple HowTo:

Install the library

        npm install --save cometd

Include the library

        var cometD = require('cometd').cometD();
    
Subscribe to a topic

        cometD.topic = '/topic/exampleTopic';

Add a eventListener

        cometD.addEventListener('/topic/exampleTopic', function (topic, message) {});

Start the execution

        cometD.init(
            {
                token: "A optional Bearer token",
                url: 'http://urltoyourservice.com/cometd/26.0',
                debug: true
            }
        );

###Multi Subscription

You have two options for subscribe more than one topic. You can use a wildcard in your topic like this:

        cometD.topic = '/topic/*';

If you use this, you can add a eventListener to each channel. 

        cometD.addEventListener('/topic/topic1', function (topic, message) {});
        cometD.addEventListener('/topic/topic2', function (topic, message) {});

Or you can use only one handler function. You can also access the topicName:

        function myHandler(theTopicName, message){
          console.log(theTopicName);
        }

        cometD.addEventListener('/topic/topic1', myHandler);
        cometD.addEventListener('/topic/topic2', myHandler);

Sometime wildcards are not available. But this isn't a problem. The cometD object isn't a singleton. Each Instance has his own cookie. 
    
        var topics = ['topic1', 'topic2'];

        function myCometDFunction(topic){
           var cometD = require('./cometD.js').cometD();

           cometD.topic = '/topic/' + topic;
           cometD.init(
               {
                 token: "Bearer Token",
                 url: 'http://aserviceurl.com/cometd/26.0',
                 debug: true
               }
           );

           cometD.addEventListener('/topic/' + topic, function(topicName, message){});
         }


        for (var i = 0; i < topics.length; i++) {
          myCometDFunction(topics[i]);
        }
