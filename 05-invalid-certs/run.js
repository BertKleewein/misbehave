// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

"use strict";

const Protocol = require("azure-iot-device-mqtt").Mqtt;
// Uncomment one of these transports and then change it in fromConnectionString to test other transports
// const Protocol = require('azure-iot-device-amqp').AmqpWs;
// const Protocol = require('azure-iot-device-http').Http;
// const Protocol = require("azure-iot-device-amqp").Amqp;
// const Protocol = require('azure-iot-device-mqtt').MqttWs;
const Client = require("azure-iot-device").Client;
const Message = require("azure-iot-device").Message;
const X509AuthenticationProvider =
  require("azure-iot-device").X509AuthenticationProvider;
const fs = require("fs");

const hubName = process.env.IOTHUB_TEST_HUB_NAME + ".azure-devices.net";
const deviceId = process.env.IOTHUB_TEST_DEVICE_ID;
const keyFileName = process.env.IOTHUB_TEST_KEY_FILENAME;
const certFileName = process.env.IOTHUB_TEST_CERT_FILENAME;

if (!hubName || !deviceId || !keyFileName || !certFileName) {
  console.log(`${hubName}, ${deviceId}, ${keyFileName}, ${certFileName}`);
  throw Error("environment variable missing");
}

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

const x509Provider = X509AuthenticationProvider.fromX509Options(
  deviceId,
  hubName,
  { cert: fs.readFileSync(certFileName), key: fs.readFileSync(keyFileName) }
);
const client = Client.fromAuthenticationProvider(x509Provider, Protocol);
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

client
  .open()
  .then(() => {
    console.log("client opened");
  })
  .catch((err) => {
    console.error("CATCH: Could not connect: " + err.message);
  });
