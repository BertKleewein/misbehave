// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

"use strict";

const identity_helper = require("./device_identity_helper");
const Protocol = require("azure-iot-device-mqtt").Mqtt;
// Uncomment one of these transports and then change it in fromConnectionString to test other transports
// const Protocol = require('azure-iot-device-amqp').AmqpWs;
// const Protocol = require('azure-iot-device-http').Http;
// const Protocol = require('azure-iot-device-amqp').Amqp;
// const Protocol = require('azure-iot-device-mqtt').MqttWs;
const Client = require("azure-iot-device").Client;
const Message = require("azure-iot-device").Message;
const FakeTimers = require("@sinonjs/fake-timers");

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

// HACK: time travel 5.5 minutes into the past
console.log("Hacking the date");
console.log("Before hack = " + Date.now() + " = " + Date());
FakeTimers.install({
  now: Date.now() - 330000,
  toFake: ["Date"],
  shouldAdvanceTime: true,
});
console.log("After hack = " + Date.now() + " = " + Date());
// END HACK

identity_helper.createDeviceWithSymmetricKey("expiring_sas_", (err, dev) => {
  if (err) {
    throw err;
  } else {
    let client = Client.fromConnectionString(dev.connectionString, Protocol);
    let sendInterval;

    client.on("connect", () => {
      console.log("------------------------------------------");
      console.log("EVENT: connected");
      console.log("------------------------------------------");
      // Create a message and send it to the IoT Hub every five seconds
      if (sendInterval) {
        clearInterval(sendInterval);
        sendInterval = null;
      }
      sendInterval = setInterval(() => {
        const message = generateMessage();
        console.log("Sending message: " + message.getData());
        client.sendEvent(message, printResultFor("send"));
      }, 5000);
    });

    client.on("error", (err) => {
      console.error("ERROR EVENT: " + err.message);
    });

    client.on("disconnect", () => {
      console.log("------------------------------------------");
      console.log(
        "EVENT disconnected.  Stopping send interval and not reconnecting."
      );
      console.log("------------------------------------------");
      if (sendInterval) {
        clearInterval(sendInterval);
        sendInterval = null;
      }
      /*
      client.open().catch((err) => {
        console.error(err.message);
      });
      */
    });

    client.on("message", (msg) => {
      console.log("Id: " + msg.messageId + " Body: " + msg.data);
      client.complete(msg, printResultFor("completed"));
    });

    let ap = client._transport._authenticationProvider;
    ap.on("newTokenAvailable", (credentials) => {
      console.log("EVENT: New credentials:");
      console.dir(credentials);
    });

    client
      .setOptions({
        tokenRenewal: {
          tokenValidTimeInSeconds: 40,
          tokenRenewalMarginInSeconds: 10,
        },
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
        // HACK the authentication provider so token doesn't renew
        console.log("replacing renewal function");
        ap._expiryTimerHandler = (() => {
          console.log("------------------------------------------");
          console.log("I'm supposed to renew the token now, but I ain't gonna");
          console.log("------------------------------------------");
        }).bind(ap);
        // END HACK
      });
  }
});
