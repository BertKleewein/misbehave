// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

"use strict";

const identity_helper = require("./device_identity_helper");
const Mqtt = require("azure-iot-device-mqtt").Mqtt;
const MqttWs = require("azure-iot-device-mqtt").MqttWs;
const Amqp = require("azure-iot-device-amqp").Amqp;
const AmqpWs = require("azure-iot-device-amqp").AmqpWs;
const Protocol = Amqp;
const Client = require("azure-iot-device").Client;
const Message = require("azure-iot-device").Message;

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
  return message;
}

// Helper function to print results in the console
function printResultFor(op) {
  return function printResult(err, res) {
    if (err) console.log(Date() + op + " error: " + err.toString());
    if (res) console.log(Date() + op + " status: " + res.constructor.name);
  };
}

identity_helper.createDeviceWithSymmetricKey(
  "no_send_keepalive",
  (err, dev) => {
    if (err) {
      throw err;
    } else {
      let client = Client.fromConnectionString(dev.connectionString, Protocol);

      client.on("connect", () => {
        console.log("------------------------------------------");
        console.log("EVENT: connected " + Date());
        console.log("------------------------------------------");
        if (Protocol == Mqtt || Protocol == MqttWs) {
          var mqttjsClient = client._transport._mqtt._mqttClient;

          console.log("Hooking _sendPacket and _handlePacket");
          var innerSend = mqttjsClient._sendPacket.bind(mqttjsClient);
          mqttjsClient._sendPacket = (packet, cb) => {
            if (packet.cmd == "pingreq") {
              console.log("NOT sending " + JSON.stringify(packet));
              if (!!cb) cb();
            } else {
              console.log("sending " + JSON.stringify(packet));
              return innerSend(packet, cb);
            }
          };

          var innerHandle = mqttjsClient._handlePacket.bind(mqttjsClient);
          mqttjsClient._handlePacket = (packet, done) => {
            console.log("received " + JSON.stringify(packet));
            return innerHandle(packet, done);
          };
        } else if (Protocol == Amqp || Protocol == AmqpWs) {
          console.log("Setting keepalive send interval to 30 minutes");
          client._transport._amqp._rheaConnection.remote.open.idle_time_out =
            30 * 60 * 1000 * 2;
          const message = generateMessage();
          console.log("Sending message: " + message.getData());
          client.sendEvent(message, printResultFor("send"));
        }
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
        .then(client.open)
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
  }
);
