// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

"use strict";

const identity_helper = require("./device_identity_helper");
const Protocol = require("azure-iot-device-mqtt").Mqtt;
// Uncomment one of these transports and then change it in fromConnectionString to test other transports
// const Protocol = require('azure-iot-device-mqtt').MqttWs;
const Client = require("azure-iot-device").Client;
const Message = require("azure-iot-device").Message;

identity_helper.createDeviceWithSymmetricKey("expiring_sas_", (err, dev) => {
  if (err) {
    throw err;
  } else {
    let client = Client.fromConnectionString(dev.connectionString, Protocol);

    client.on("connect", () => {
      console.log("------------------------------------------");
      console.log("EVENT: connected");
      console.log("------------------------------------------");
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
    });

    client.on("error", (err) => {
      console.error("ERROR EVENT: " + err.message);
    });

    client.on("disconnect", () => {
      console.log("------------------------------------------");
      console.log("EVENT disconnected.");
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
