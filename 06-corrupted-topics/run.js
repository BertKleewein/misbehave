// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

"use strict";

process.env.DEBUG = "";

const identity_helper = require("./device_identity_helper");
const Mqtt = require("azure-iot-device-mqtt").Mqtt;
const MqttWs = require("azure-iot-device-mqtt").MqttWs;
const Amqp = require("azure-iot-device-amqp").Amqp;
const AmqpWs = require("azure-iot-device-amqp").AmqpWs;
const Protocol = Mqtt;
const Client = require("azure-iot-device").Client;
const Message = require("azure-iot-device").Message;
var MqttClient = require("mqtt").MqttClient;

const BAD_EXPIRY = "bad_expiry";
const TOTALLY_BOGUS_TOPIC = "totally_bogus_topic";
var scenario = BAD_EXPIRY;

if (process.argv.length == 3) {
  scenario = process.argv[2];
}
console.log("scenario is " + scenario);

// valid: topic = "devices/" + deviceId + "/messages/events/%24.mid=12345&%24.cid=id&%24.uid=id&%24.to=destination&%24.ct=text%2Fjson&%24.ce=UTF-8&temperatureAlert=false"

var deviceId;
MqttClient.prototype.innerPublish = MqttClient.prototype.publish;
MqttClient.prototype.publish = function (topic, message, opts, callback) {
  switch (scenario) {
    case BAD_EXPIRY:
      break;
    case TOTALLY_rBOGUS_TOPIC:
      topic = "foo";
      break;
    case "corruption1":
      // ? in topic segment
      topic =
        "devices/" +
        deviceId +
        "/messages/?events/%24.mid=12345&%24.cid=id&%24.uid=id&%24.to=destination&%24.ct=text%2Fjson&%24.ce=UTF-8&temperatureAlert=false";
      break;
    case "corruption2":
      // ? before query string
      topic =
        "devices/" +
        deviceId +
        "/messages/events/?%24.mid=12345&%24.cid=id&%24.uid=id&%24.to=destination&%24.ct=text%2Fjson&%24.ce=UTF-8&temperatureAlert=false";
      break;
    case "corruption3":
      // property without value
      topic = "devices/" + deviceId + "/messages/events/%24.mid";
      break;
    case "corruption4":
      // Property with &&& value
      topic =
        "devices/" + deviceId + "/messages/events/%24.mid=12345&%24.cid=&&&";
      break;
    case "corruption5":
      // &&& in topic segment
      "devices/" + deviceId + "/%%%%%%/events/%24.mid=12345&%24.cid=&&&";
      break;
    case "corruption6":
      // empty property value in middle of string
      topic =
        "devices/" +
        deviceId +
        "/messages/events/%24.mid=&%24.cid=id&%24.uid=id&%24.to=destination&%24.ct=text%2Fjson&%24.ce=UTF-8&temperatureAlert=false";
      break;
    case "corruption7":
      // extra segment
      topic = "devices/" + deviceId + "/messages/events/andMore";
      break;
    case "corruption8":
      // incorrect segment
      topic = "devices/" + deviceId + "/messages/eventsAndMore";
      break;
    case "corruption9":
      // truncated topic
      topic = "devices/" + deviceId + "/messa";
      break;
    case "corruption10":
      // truncated topic
      topic = "devices/" + deviceId + "/messages/event";
      break;
    case "corruption11":
      // incorrect device ID and truncated
      topic = "devices/test6c18f";
      break;
    case "corruption12":
      // valid topic with incorrect device ID
      topic =
        "devices/test6c18f895-/messages/events/%24.mid=12345&%24.cid=id&%24.uid=id&%24.to=destination&%24.ct=text%2Fjson&%24.ce=UTF-8&temperatureAlert=false";
      break;
    default:
      topic = "undefined_topic";
      break;
  }

  console.log("publish to " + topic);
  return this.innerPublish(topic, message, opts, callback);
};

function generateMessage() {
  const windSpeed = 10 + Math.random() * 4; // range: [10, 14]
  const temperature = 20 + Math.random() * 10; // range: [20, 30]
  const humidity = 60 + Math.random() * 20; // range: [60, 80]
  const data = JSON.stringify({
    deviceId: "myFirstDevice",
    windSpeed: windSpeed,
    temperature: temperature,
    humidity: humidity,
  });
  const message = new Message(data);
  message.properties.add(
    "temperatureAlert",
    temperature > 28 ? "true" : "false"
  );

  message.messageId = "12345";
  message.to = "destination";
  message.contentEncoding = "UTF-8";
  message.contentType = "text/json";
  message.lockToken = "token";
  message.correlationId = "id";
  message.userId = "id";

  switch (scenario) {
    case BAD_EXPIRY:
      message.expiryTimeUtc = new Date().toUTCString();
      break;
  }

  return message;
}

// Helper function to print results in the console
function printResultFor(op) {
  return function printResult(err, res) {
    if (err) console.log(Date() + op + " error: " + err.toString());
    if (res) console.log(Date() + op + " status: " + res.constructor.name);
  };
}

identity_helper.createDeviceWithSymmetricKey(scenario + "__", (err, dev) => {
  if (err) {
    throw err;
  } else {
    let client = Client.fromConnectionString(dev.connectionString, Protocol);
    deviceId = dev.deviceId;

    client.on("connect", () => {
      console.log("------------------------------------------");
      console.log("EVENT: connected " + Date());
      console.log("------------------------------------------");

      client.sendEvent(generateMessage(), (err) => {
        if (err) {
          console.log("Message 1 error:" + err.toString());
        } else {
          console.log("Message 1 send");
        }
      });
    });

    client.on("error", (err) => {
      console.error("ERROR EVENT " + Date() + ": " + err.message);
    });

    client.on("disconnect", () => {
      console.log("------------------------------------------");
      console.log("EVENT disconnected " + Date());
      console.log("------------------------------------------");
    });

    client.on("message", (msg) => {
      console.log("Id: " + msg.messageId + " Body: " + msg.data);
      client.complete(msg, printResultFor("completed"));
    });

    client
      .setOptions({
        keepalive: 20,
      })
      .then(() => {
        console.log("options set");
      })
      .then(() => client.open())
      .then(() => {
        console.log("client opened");
      })
      .catch((err) => {
        console.error("CATCH: Could not connect: " + err.message);
      })
      .finally(() => {
        console.log("------------------------------------------");
        console.log("RUNNNIG");
        console.log("------------------------------------------");
      });
  }
});
