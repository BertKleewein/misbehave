// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

"use strict";

const identity_helper = require("./device_identity_helper");
const Mqtt = require("azure-iot-device-mqtt").Mqtt;
const MqttWs = require("azure-iot-device-mqtt").MqttWs;
const Amqp = require("azure-iot-device-amqp").Amqp;
const AmqpWs = require("azure-iot-device-amqp").AmqpWs;
const Protocol = Mqtt;
const Client = require("azure-iot-device").Client;
const Message = require("azure-iot-device").Message;
const DeviceMethodResponse = require("azure-iot-device").DeviceMethodResponse;

identity_helper.createDeviceWithSymmetricKey("bad_content", (err, dev) => {
  if (err) {
    throw err;
  } else {
    let client = Client.fromConnectionString(dev.connectionString, Protocol);

    client.on("connect", () => {
      console.log("------------------------------------------");
      console.log("EVENT: connected " + Date());
      console.log("------------------------------------------");

      var oneKilobyte = "";
      for (var i = 0; i < 1024; i++) {
        oneKilobyte += "A";
      }
      var twoSeventy = "";
      for (var i = 0; i < 270; i++) {
        twoSeventy += oneKilobyte;
      }

      client.sendEvent(
        new Message(JSON.stringify({ data: twoSeventy })),
        (err) => {
          console.log("send returned " + err);
        }
      );
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
});
