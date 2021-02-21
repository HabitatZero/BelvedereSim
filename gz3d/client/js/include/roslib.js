/**
 * @author Russell Toris - rctoris@wpi.edu
 */

var ROSLIB = ROSLIB || {
  REVISION: "6",
};

// URDF types
ROSLIB.URDF_SPHERE = 0;
ROSLIB.URDF_BOX = 1;
ROSLIB.URDF_CYLINDER = 2;
ROSLIB.URDF_MESH = 3;

/**
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * An actionlib action client.
 *
 * Emits the following events:
 *  * 'timeout' - if a timeout occurred while sending a goal
 *  * 'status' - the status messages received from the action server
 *  * 'feedback' -  the feedback messages received from the action server
 *  * 'result' - the result returned from the action server
 *
 *  @constructor
 *  @param options - object with following keys:
 *   * ros - the ROSLIB.Ros connection handle
 *   * serverName - the action server name, like /fibonacci
 *   * actionName - the action message name, like 'actionlib_tutorials/FibonacciAction'
 *   * timeout - the timeout length when connecting to the action server
 */
ROSLIB.ActionClient = function (options) {
  const that = this;
  options = options || {};
  this.ros = options.ros;
  this.serverName = options.serverName;
  this.actionName = options.actionName;
  this.timeout = options.timeout;
  this.goals = {};

  // flag to check if a status has been received
  let receivedStatus = false;

  // create the topics associated with actionlib
  const feedbackListener = new ROSLIB.Topic({
    ros: this.ros,
    name: this.serverName + "/feedback",
    messageType: this.actionName + "Feedback",
  });

  const statusListener = new ROSLIB.Topic({
    ros: this.ros,
    name: this.serverName + "/status",
    messageType: "actionlib_msgs/GoalStatusArray",
  });

  const resultListener = new ROSLIB.Topic({
    ros: this.ros,
    name: this.serverName + "/result",
    messageType: this.actionName + "Result",
  });

  this.goalTopic = new ROSLIB.Topic({
    ros: this.ros,
    name: this.serverName + "/goal",
    messageType: this.actionName + "Goal",
  });

  this.cancelTopic = new ROSLIB.Topic({
    ros: this.ros,
    name: this.serverName + "/cancel",
    messageType: "actionlib_msgs/GoalID",
  });

  // advertise the goal and cancel topics
  this.goalTopic.advertise();
  this.cancelTopic.advertise();

  // subscribe to the status topic
  statusListener.subscribe(function (statusMessage) {
    receivedStatus = true;
    statusMessage.status_list.forEach(function (status) {
      const goal = that.goals[status.goal_id.id];
      if (goal) {
        goal.emit("status", status);
      }
    });
  });

  // subscribe the the feedback topic
  feedbackListener.subscribe(function (feedbackMessage) {
    const goal = that.goals[feedbackMessage.status.goal_id.id];
    if (goal) {
      goal.emit("status", feedbackMessage.status);
      goal.emit("feedback", feedbackMessage.feedback);
    }
  });

  // subscribe to the result topic
  resultListener.subscribe(function (resultMessage) {
    const goal = that.goals[resultMessage.status.goal_id.id];

    if (goal) {
      goal.emit("status", resultMessage.status);
      goal.emit("result", resultMessage.result);
    }
  });

  // If timeout specified, emit a 'timeout' event if the action server does not respond
  if (this.timeout) {
    setTimeout(function () {
      if (!receivedStatus) {
        that.emit("timeout");
      }
    }, this.timeout);
  }
};
ROSLIB.ActionClient.prototype.__proto__ = EventEmitter2.prototype;

/**
 * Cancel all goals associated with this ActionClient.
 */
ROSLIB.ActionClient.prototype.cancel = function () {
  const cancelMessage = new ROSLIB.Message();
  this.cancelTopic.publish(cancelMessage);
};

/**
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * An actionlib goal goal is associated with an action server.
 *
 * Emits the following events:
 *  * 'timeout' - if a timeout occurred while sending a goal
 *
 *  @constructor
 *  @param object with following keys:
 *   * actionClient - the ROSLIB.ActionClient to use with this goal
 *   * goalMessage - The JSON object containing the goal for the action server
 */
ROSLIB.Goal = function (options) {
  const that = this;
  this.actionClient = options.actionClient;
  this.goalMessage = options.goalMessage;
  this.isFinished = false;

  // Used to create random IDs
  const date = new Date();

  // Create a random ID
  this.goalID = "goal_" + Math.random() + "_" + date.getTime();
  // Fill in the goal message
  this.goalMessage = new ROSLIB.Message({
    goal_id: {
      stamp: {
        secs: 0,
        nsecs: 0,
      },
      id: this.goalID,
    },
    goal: this.goalMessage,
  });

  this.on("status", function (status) {
    that.status = status;
  });

  this.on("result", function (result) {
    that.isFinished = true;
    that.result = result;
  });

  this.on("feedback", function (feedback) {
    that.feedback = feedback;
  });

  // Add the goal
  this.actionClient.goals[this.goalID] = this;
};
ROSLIB.Goal.prototype.__proto__ = EventEmitter2.prototype;

/**
 * Send the goal to the action server.
 *
 * @param timeout (optional) - a timeout length for the goal's result
 */
ROSLIB.Goal.prototype.send = function (timeout) {
  const that = this;
  that.actionClient.goalTopic.publish(that.goalMessage);
  if (timeout) {
    setTimeout(function () {
      if (!that.isFinished) {
        that.emit("timeout");
      }
    }, timeout);
  }
};

/**
 * Cancel the current goal.
 */
ROSLIB.Goal.prototype.cancel = function () {
  const cancelMessage = new ROSLIB.Message({
    id: this.goalID,
  });
  this.actionClient.cancelTopic.publish(cancelMessage);
};

/**
 * @author Brandon Alexander - baalexander@gmail.com
 */

/**
 * Message objects are used for publishing and subscribing to and from topics.
 *
 * @constructor
 * @param values - object matching the fields defined in the .msg definition file
 */
ROSLIB.Message = function (values) {
  const that = this;
  values = values || {};

  Object.keys(values).forEach(function (name) {
    that[name] = values[name];
  });
};

/**
 * @author Brandon Alexander - baalexander@gmail.com
 */

/**
 * A ROS parameter.
 *
 * @constructor
 * @param options - possible keys include:
 *   * ros - the ROSLIB.Ros connection handle
 *   * name - the param name, like max_vel_x
 */
ROSLIB.Param = function (options) {
  options = options || {};
  this.ros = options.ros;
  this.name = options.name;
};

/**
 * Fetches the value of the param.
 *
 * @param callback - function with the following params:
 *  * value - the value of the param from ROS.
 */
ROSLIB.Param.prototype.get = function (callback) {
  const paramClient = new ROSLIB.Service({
    ros: this.ros,
    name: "/rosapi/get_param",
    serviceType: "rosapi/GetParam",
  });

  const request = new ROSLIB.ServiceRequest({
    name: this.name,
    value: JSON.stringify(""),
  });

  paramClient.callService(request, function (result) {
    const value = JSON.parse(result.value);
    callback(value);
  });
};

/**
 * Sets the value of the param in ROS.
 *
 * @param value - value to set param to.
 */
ROSLIB.Param.prototype.set = function (value) {
  const paramClient = new ROSLIB.Service({
    ros: this.ros,
    name: "/rosapi/set_param",
    serviceType: "rosapi/SetParam",
  });

  const request = new ROSLIB.ServiceRequest({
    name: this.name,
    value: JSON.stringify(value),
  });

  paramClient.callService(request, function () {});
};

/**
 * @author Brandon Alexander - baalexander@gmail.com
 */

/**
 * Manages connection to the server and all interactions with ROS.
 *
 * Emits the following events:
 *  * 'error' - there was an error with ROS
 *  * 'connection' - connected to the WebSocket server
 *  * 'close' - disconnected to the WebSocket server
 *  * <topicName> - a message came from rosbridge with the given topic name
 *  * <serviceID> - a service response came from rosbridge with the given ID
 *
 * @constructor
 * @param options - possible keys include:
 *   * url (optional) - the WebSocket URL for rosbridge (can be specified later with `connect`)
 */
ROSLIB.Ros = function (options) {
  options = options || {};
  const url = options.url;
  this.socket = null;
  this.idCounter = 0;

  // Sets unlimited event listeners.
  this.setMaxListeners(0);

  // begin by checking if a URL was given
  if (url) {
    this.connect(url);
  }
};
ROSLIB.Ros.prototype.__proto__ = EventEmitter2.prototype;

/**
 * Connect to the specified WebSocket.
 *
 * @param url - WebSocket URL for Rosbridge
 */
ROSLIB.Ros.prototype.connect = function (url) {
  const that = this;

  /**
   * Emits a 'connection' event on WebSocket connection.
   *
   * @param event - the argument to emit with the event.
   */
  function onOpen(event) {
    that.emit("connection", event);
  }

  /**
   * Emits a 'close' event on WebSocket disconnection.
   *
   * @param event - the argument to emit with the event.
   */
  function onClose(event) {
    that.emit("close", event);
  }

  /**
   * Emits an 'error' event whenever there was an error.
   *
   * @param event - the argument to emit with the event.
   */
  function onError(event) {
    that.emit("error", event);
  }

  /**
   * If a message was compressed as a PNG image (a compression hack since
   * gzipping over WebSockets * is not supported yet), this function places the
   * "image" in a canvas element then decodes the * "image" as a Base64 string.
   *
   * @param data - object containing the PNG data.
   * @param callback - function with params:
   *   * data - the uncompressed data
   */
  function decompressPng(data, callback) {
    // Uncompresses the data before sending it through (use image/canvas to do so).
    const image = new Image();
    // When the image loads, extracts the raw data (JSON message).
    image.onload = function () {
      // Creates a local canvas to draw on.
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      // Sets width and height.
      canvas.width = image.width;
      canvas.height = image.height;

      // Puts the data into the image.
      context.drawImage(image, 0, 0);
      // Grabs the raw, uncompressed data.
      const imageData = context.getImageData(0, 0, image.width, image.height)
        .data;

      // Constructs the JSON.
      let jsonData = "";
      for (let i = 0; i < imageData.length; i += 4) {
        // RGB
        jsonData += String.fromCharCode(
          imageData[i],
          imageData[i + 1],
          imageData[i + 2]
        );
      }
      const decompressedData = JSON.parse(jsonData);
      callback(decompressedData);
    };
    // Sends the image data to load.
    image.src = "data:image/png;base64," + data.data;
  }

  /**
   * Parses message responses from rosbridge and sends to the appropriate
   * topic, service, or param.
   *
   * @param message - the raw JSON message from rosbridge.
   */
  function onMessage(message) {
    function handleMessage(message) {
      if (message.op === "publish") {
        that.emit(message.topic, message.msg);
      } else if (message.op === "service_response") {
        that.emit(message.id, message.values);
      }
    }

    const data = JSON.parse(message.data);
    if (data.op === "png") {
      decompressPng(data, function (decompressedData) {
        handleMessage(decompressedData);
      });
    } else {
      handleMessage(data);
    }
  }

  this.socket = new WebSocket(url);
  this.socket.onopen = onOpen;
  this.socket.onclose = onClose;
  this.socket.onerror = onError;
  this.socket.onmessage = onMessage;
};

/**
 * Disconnect from the WebSocket server.
 */
ROSLIB.Ros.prototype.close = function () {
  if (this.socket) {
    this.socket.close();
  }
};

/**
 * Sends an authorization request to the server.
 *
 * @param mac - MAC (hash) string given by the trusted source.
 * @param client - IP of the client.
 * @param dest - IP of the destination.
 * @param rand - Random string given by the trusted source.
 * @param t - Time of the authorization request.
 * @param level - User level as a string given by the client.
 * @param end - End time of the client's session.
 */
ROSLIB.Ros.prototype.authenticate = function (
  mac,
  client,
  dest,
  rand,
  t,
  level,
  end
) {
  // create the request
  const auth = {
    op: "auth",
    mac: mac,
    client: client,
    dest: dest,
    rand: rand,
    t: t,
    level: level,
    end: end,
  };
  // send the request
  this.callOnConnection(auth);
};

/**
 * Sends the message over the WebSocket, but queues the message up if not yet
 * connected.
 */
ROSLIB.Ros.prototype.callOnConnection = function (message) {
  const that = this;
  const messageJson = JSON.stringify(message);

  if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
    that.once("connection", function () {
      that.socket.send(messageJson);
    });
  } else {
    that.socket.send(messageJson);
  }
};

/**
 * Retrieves list of topics in ROS as an array.
 *
 * @param callback function with params:
 *   * topics - Array of topic names
 */
ROSLIB.Ros.prototype.getTopics = function (callback) {
  const topicsClient = new ROSLIB.Service({
    ros: this,
    name: "/rosapi/topics",
    serviceType: "rosapi/Topics",
  });

  const request = new ROSLIB.ServiceRequest();

  topicsClient.callService(request, function (result) {
    callback(result.topics);
  });
};

/**
 * Retrieves list of active service names in ROS.
 *
 * @param callback - function with the following params:
 *   * services - array of service names
 */
ROSLIB.Ros.prototype.getServices = function (callback) {
  const servicesClient = new ROSLIB.Service({
    ros: this,
    name: "/rosapi/services",
    serviceType: "rosapi/Services",
  });

  const request = new ROSLIB.ServiceRequest();

  servicesClient.callService(request, function (result) {
    callback(result.services);
  });
};

/**
 * Retrieves list of param names from the ROS Parameter Server.
 *
 * @param callback function with params:
 *  * params - array of param names.
 */
ROSLIB.Ros.prototype.getParams = function (callback) {
  const paramsClient = new ROSLIB.Service({
    ros: this,
    name: "/rosapi/get_param_names",
    serviceType: "rosapi/GetParamNames",
  });

  const request = new ROSLIB.ServiceRequest();
  paramsClient.callService(request, function (result) {
    callback(result.names);
  });
};

/**
 * @author Brandon Alexander - baalexander@gmail.com
 */

/**
 * A ROS service client.
 *
 * @constructor
 * @params options - possible keys include:
 *   * ros - the ROSLIB.Ros connection handle
 *   * name - the service name, like /add_two_ints
 *   * serviceType - the service type, like 'rospy_tutorials/AddTwoInts'
 */
ROSLIB.Service = function (options) {
  options = options || {};
  this.ros = options.ros;
  this.name = options.name;
  this.serviceType = options.serviceType;
};

/**
 * Calls the service. Returns the service response in the callback.
 *
 * @param request - the ROSLIB.ServiceRequest to send
 * @param callback - function with params:
 *   * response - the response from the service request
 */
ROSLIB.Service.prototype.callService = function (request, callback) {
  this.ros.idCounter++;
  const serviceCallId = "call_service:" + this.name + ":" + this.ros.idCounter;

  this.ros.once(serviceCallId, function (data) {
    const response = new ROSLIB.ServiceResponse(data);
    callback(response);
  });

  const requestValues = [];
  Object.keys(request).forEach(function (name) {
    requestValues.push(request[name]);
  });

  const call = {
    op: "call_service",
    id: serviceCallId,
    service: this.name,
    args: requestValues,
  };
  this.ros.callOnConnection(call);
};

/**
 * @author Brandon Alexander - balexander@willowgarage.com
 */

/**
 * A ServiceRequest is passed into the service call.
 *
 * @constructor
 * @param values - object matching the fields defined in the .srv definition file
 */
ROSLIB.ServiceRequest = function (values) {
  const that = this;
  values = values || {};

  Object.keys(values).forEach(function (name) {
    that[name] = values[name];
  });
};

/**
 * @author Brandon Alexander - balexander@willowgarage.com
 */

/**
 * A ServiceResponse is returned from the service call.
 *
 * @constructor
 * @param values - object matching the fields defined in the .srv definition file
 */
ROSLIB.ServiceResponse = function (values) {
  const that = this;
  values = values || {};

  Object.keys(values).forEach(function (name) {
    that[name] = values[name];
  });
};

/**
 * @author Brandon Alexander - baalexander@gmail.com
 */

/**
 * Publish and/or subscribe to a topic in ROS.
 *
 * Emits the following events:
 *  * 'warning' - if there are any warning during the Topic creation
 *  * 'message' - the message data from rosbridge
 *
 * @constructor
 * @param options - object with following keys:
 *   * ros - the ROSLIB.Ros connection handle
 *   * name - the topic name, like /cmd_vel
 *   * messageType - the message type, like 'std_msgs/String'
 *   * compression - the type of compression to use, like 'png'
 *   * throttle_rate - the rate at which to throttle the topics
 */
ROSLIB.Topic = function (options) {
  options = options || {};
  this.ros = options.ros;
  this.name = options.name;
  this.messageType = options.messageType;
  this.isAdvertised = false;
  this.compression = options.compression || "none";
  this.throttle_rate = options.throttle_rate || 0;

  // Check for valid compression types
  if (
    this.compression &&
    this.compression !== "png" &&
    this.compression !== "none"
  ) {
    this.emit(
      "warning",
      this.compression +
        " compression is not supported. No compression will be used."
    );
  }

  // Check if throttle rate is negative
  if (this.throttle_rate < 0) {
    this.emit("warning", this.throttle_rate + " is not allowed. Set to 0");
    this.throttle_rate = 0;
  }
};
ROSLIB.Topic.prototype.__proto__ = EventEmitter2.prototype;

/**
 * Every time a message is published for the given topic, the callback
 * will be called with the message object.
 *
 * @param callback - function with the following params:
 *   * message - the published message
 */
ROSLIB.Topic.prototype.subscribe = function (callback) {
  const that = this;

  this.on("message", function (message) {
    callback(message);
  });

  this.ros.on(this.name, function (data) {
    const message = new ROSLIB.Message(data);
    that.emit("message", message);
  });

  this.ros.idCounter++;
  const subscribeId = "subscribe:" + this.name + ":" + this.ros.idCounter;
  const call = {
    op: "subscribe",
    id: subscribeId,
    type: this.messageType,
    topic: this.name,
    compression: this.compression,
    throttle_rate: this.throttle_rate,
  };

  this.ros.callOnConnection(call);
};

/**
 * Unregisters as a subscriber for the topic. Unsubscribing will remove
 * all subscribe callbacks.
 */
ROSLIB.Topic.prototype.unsubscribe = function () {
  this.ros.removeAllListeners([this.name]);
  this.ros.idCounter++;
  const unsubscribeId = "unsubscribe:" + this.name + ":" + this.ros.idCounter;
  const call = {
    op: "unsubscribe",
    id: unsubscribeId,
    topic: this.name,
  };
  this.ros.callOnConnection(call);
};

/**
 * Registers as a publisher for the topic.
 */
ROSLIB.Topic.prototype.advertise = function () {
  this.ros.idCounter++;
  const advertiseId = "advertise:" + this.name + ":" + this.ros.idCounter;
  const call = {
    op: "advertise",
    id: advertiseId,
    type: this.messageType,
    topic: this.name,
  };
  this.ros.callOnConnection(call);
  this.isAdvertised = true;
};

/**
 * Unregisters as a publisher for the topic.
 */
ROSLIB.Topic.prototype.unadvertise = function () {
  this.ros.idCounter++;
  const unadvertiseId = "unadvertise:" + this.name + ":" + this.ros.idCounter;
  const call = {
    op: "unadvertise",
    id: unadvertiseId,
    topic: this.name,
  };
  this.ros.callOnConnection(call);
  this.isAdvertised = false;
};

/**
 * Publish the message.
 *
 * @param message - A ROSLIB.Message object.
 */
ROSLIB.Topic.prototype.publish = function (message) {
  if (!this.isAdvertised) {
    this.advertise();
  }

  this.ros.idCounter++;
  const publishId = "publish:" + this.name + ":" + this.ros.idCounter;
  const call = {
    op: "publish",
    id: publishId,
    topic: this.name,
    msg: message,
  };
  this.ros.callOnConnection(call);
};

/**
 * @author David Gossow - dgossow@willowgarage.com
 */

/**
 * A Pose in 3D space. Values are copied into this object.
 *
 *  @constructor
 *  @param options - object with following keys:
 *   * position - the Vector3 describing the position
 *   * orientation - the ROSLIB.Quaternion describing the orientation
 */
ROSLIB.Pose = function (options) {
  options = options || {};
  // copy the values into this object if they exist
  this.position = new ROSLIB.Vector3(options.position);
  this.orientation = new ROSLIB.Quaternion(options.orientation);
};

/**
 * Apply a transform against this pose.
 *
 * @param tf the transform
 */
ROSLIB.Pose.prototype.applyTransform = function (tf) {
  this.position.multiplyQuaternion(tf.rotation);
  this.position.add(tf.translation);
  const tmp = tf.rotation.clone();
  tmp.multiply(this.orientation);
  this.orientation = tmp;
};

/**
 * Clone a copy of this pose.
 *
 * @returns the cloned pose
 */
ROSLIB.Pose.prototype.clone = function () {
  return new ROSLIB.Pose(this);
};

/**
 * @author David Gossow - dgossow@willowgarage.com
 */

/**
 * A Quaternion.
 *
 *  @constructor
 *  @param options - object with following keys:
 *   * x - the x value
 *   * y - the y value
 *   * z - the z value
 *   * w - the w value
 */
ROSLIB.Quaternion = function (options) {
  options = options || {};
  this.x = options.x || 0;
  this.y = options.y || 0;
  this.z = options.z || 0;
  this.w = options.w || 1;
};

/**
 * Perform a conjugation on this quaternion.
 */
ROSLIB.Quaternion.prototype.conjugate = function () {
  this.x *= -1;
  this.y *= -1;
  this.z *= -1;
};

/**
 * Perform a normalization on this quaternion.
 */
ROSLIB.Quaternion.prototype.normalize = function () {
  let l = Math.sqrt(
    this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w
  );
  if (l === 0) {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.w = 1;
  } else {
    l = 1 / l;
    this.x = this.x * l;
    this.y = this.y * l;
    this.z = this.z * l;
    this.w = this.w * l;
  }
};

/**
 * Convert this quaternion into its inverse.
 */
ROSLIB.Quaternion.prototype.invert = function () {
  this.conjugate();
  this.normalize();
};

/**
 * Set the values of this quaternion to the product of itself and the given quaternion.
 *
 * @param q the quaternion to multiply with
 */
ROSLIB.Quaternion.prototype.multiply = function (q) {
  const newX = this.x * q.w + this.y * q.z - this.z * q.y + this.w * q.x;
  const newY = -this.x * q.z + this.y * q.w + this.z * q.x + this.w * q.y;
  const newZ = this.x * q.y - this.y * q.x + this.z * q.w + this.w * q.z;
  const newW = -this.x * q.x - this.y * q.y - this.z * q.z + this.w * q.w;
  this.x = newX;
  this.y = newY;
  this.z = newZ;
  this.w = newW;
};

/**
 * Clone a copy of this quaternion.
 *
 * @returns the cloned quaternion
 */
ROSLIB.Quaternion.prototype.clone = function () {
  return new ROSLIB.Quaternion(this);
};

/**
 * @author David Gossow - dgossow@willowgarage.com
 */

/**
 * A Transform in 3-space. Values are copied into this object.
 *
 *  @constructor
 *  @param options - object with following keys:
 *   * translation - the Vector3 describing the translation
 *   * rotation - the ROSLIB.Quaternion describing the rotation
 */
ROSLIB.Transform = function (options) {
  options = options || {};
  // Copy the values into this object if they exist
  this.translation = new ROSLIB.Vector3(options.translation);
  this.rotation = new ROSLIB.Quaternion(options.rotation);
};

/**
 * Clone a copy of this transform.
 *
 * @returns the cloned transform
 */
ROSLIB.Transform.prototype.clone = function () {
  return new ROSLIB.Transform(this);
};

/**
 * @author David Gossow - dgossow@willowgarage.com
 */

/**
 * A 3D vector.
 *
 *  @constructor
 *  @param options - object with following keys:
 *   * x - the x value
 *   * y - the y value
 *   * z - the z value
 */
ROSLIB.Vector3 = function (options) {
  options = options || {};
  this.x = options.x || 0;
  this.y = options.y || 0;
  this.z = options.z || 0;
};

/**
 * Set the values of this vector to the sum of itself and the given vector.
 *
 * @param v the vector to add with
 */
ROSLIB.Vector3.prototype.add = function (v) {
  this.x += v.x;
  this.y += v.y;
  this.z += v.z;
};

/**
 * Set the values of this vector to the difference of itself and the given vector.
 *
 * @param v the vector to subtract with
 */
ROSLIB.Vector3.prototype.subtract = function (v) {
  this.x -= v.x;
  this.y -= v.y;
  this.z -= v.z;
};

/**
 * Multiply the given Quaternion with this vector.
 *
 * @param q - the quaternion to multiply with
 */
ROSLIB.Vector3.prototype.multiplyQuaternion = function (q) {
  const ix = q.w * this.x + q.y * this.z - q.z * this.y;
  const iy = q.w * this.y + q.z * this.x - q.x * this.z;
  const iz = q.w * this.z + q.x * this.y - q.y * this.x;
  const iw = -q.x * this.x - q.y * this.y - q.z * this.z;
  this.x = ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y;
  this.y = iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z;
  this.z = iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x;
};

/**
 * Clone a copy of this vector.
 *
 * @returns the cloned vector
 */
ROSLIB.Vector3.prototype.clone = function () {
  return new ROSLIB.Vector3(this);
};

/**
 * @author David Gossow - dgossow@willowgarage.com
 */

/**
 * A TF Client that listens to TFs from tf2_web_republisher.
 *
 *  @constructor
 *  @param options - object with following keys:
 *   * ros - the ROSLIB.Ros connection handle
 *   * fixedFrame - the fixed frame, like /base_link
 *   * angularThres - the angular threshold for the TF republisher
 *   * transThres - the translation threshold for the TF republisher
 *   * rate - the rate for the TF republisher
 *   * goalUpdateDelay - the goal update delay for the TF republisher
 */
ROSLIB.TFClient = function (options) {
  options = options || {};
  this.ros = options.ros;
  this.fixedFrame = options.fixedFrame || "/base_link";
  this.angularThres = options.angularThres || 2.0;
  this.transThres = options.transThres || 0.01;
  this.rate = options.rate || 10.0;
  this.goalUpdateDelay = options.goalUpdateDelay || 50;

  this.currentGoal = false;
  this.frameInfos = {};
  this.goalUpdateRequested = false;

  // Create an ActionClient
  this.actionClient = new ROSLIB.ActionClient({
    ros: this.ros,
    serverName: "/tf2_web_republisher",
    actionName: "tf2_web_republisher/TFSubscriptionAction",
  });
};

/**
 * Process the incoming TF message and send them out using the callback
 * functions.
 *
 * @param tf - the TF message from the server
 */
ROSLIB.TFClient.prototype.processFeedback = function (tf) {
  const that = this;
  tf.transforms.forEach(function (transform) {
    const frameID = transform.child_frame_id;
    const info = that.frameInfos[frameID];
    if (info !== undefined) {
      info.transform = new ROSLIB.Transform({
        translation: transform.transform.translation,
        rotation: transform.transform.rotation,
      });
      info.cbs.forEach(function (cb) {
        cb(info.transform);
      });
    }
  });
};

/**
 * Create and send a new goal to the tf2_web_republisher based on the current
 * list of TFs.
 */
ROSLIB.TFClient.prototype.updateGoal = function () {
  // Anytime the list of frames changes, we will need to send a new goal.
  if (this.currentGoal) {
    this.currentGoal.cancel();
  }

  const goalMessage = {
    source_frames: [],
    target_frame: this.fixedFrame,
    angular_thres: this.angularThres,
    trans_thres: this.transThres,
    rate: this.rate,
  };

  for (const frame in this.frameInfos) {
    goalMessage.source_frames.push(frame);
  }

  this.currentGoal = new ROSLIB.Goal({
    actionClient: this.actionClient,
    goalMessage: goalMessage,
  });
  this.currentGoal.on("feedback", this.processFeedback.bind(this));
  this.currentGoal.send();
  this.goalUpdateRequested = false;
};

/**
 * Subscribe to the given TF frame.
 *
 * @param frameID - the TF frame to subscribe to
 * @param callback - function with params:
 *   * transform - the transform data
 */
ROSLIB.TFClient.prototype.subscribe = function (frameID, callback) {
  // make sure the frame id is relative
  if (frameID[0] === "/") {
    frameID = frameID.substring(1);
  }
  // if there is no callback registered for the given frame, create emtpy callback list
  if (this.frameInfos[frameID] === undefined) {
    this.frameInfos[frameID] = {
      cbs: [],
    };
    if (!this.goalUpdateRequested) {
      setTimeout(this.updateGoal.bind(this), this.goalUpdateDelay);
      this.goalUpdateRequested = true;
    }
  } else {
    // if we already have a transform, call back immediately
    if (this.frameInfos[frameID].transform !== undefined) {
      callback(this.frameInfos[frameID].transform);
    }
  }
  this.frameInfos[frameID].cbs.push(callback);
};

/**
 * Unsubscribe from the given TF frame.
 *
 * @param frameID - the TF frame to unsubscribe from
 * @param callback - the callback function to remove
 */
ROSLIB.TFClient.prototype.unsubscribe = function (frameID, callback) {
  const info = this.frameInfos[frameID];
  if (info !== undefined) {
    const cbIndex = info.cbs.indexOf(callback);
    if (cbIndex >= 0) {
      info.cbs.splice(cbIndex, 1);
      if (info.cbs.length === 0) {
        delete this.frameInfos[frameID];
      }
      this.needUpdate = true;
    }
  }
};

/**
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * A Box element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
ROSLIB.UrdfBox = function (options) {
  options = options || {};
  const that = this;
  const xml = options.xml;
  this.dimension = null;
  this.type = null;

  /**
   * Initialize the element with the given XML node.
   *
   * @param xml - the XML element to parse
   */
  const initXml = function (xml) {
    this.type = ROSLIB.URDF_BOX;

    // Parse the string
    const xyz = xml.getAttribute("size").split(" ");
    that.dimension = new ROSLIB.Vector3({
      x: parseFloat(xyz[0]),
      y: parseFloat(xyz[1]),
      z: parseFloat(xyz[2]),
    });
  };

  // Pass it to the XML parser
  initXml(xml);
};

/**
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * A Color element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
ROSLIB.UrdfColor = function (options) {
  options = options || {};
  const that = this;
  const xml = options.xml;
  this.r = null;
  this.g = null;
  this.b = null;
  this.a = null;

  /**
   * Initialize the element with the given XML node.
   *
   * @param xml - the XML element to parse
   */
  const initXml = function (xml) {
    // Parse the string
    const rgba = xml.getAttribute("rgba").split(" ");
    that.r = parseFloat(rgba[0]);
    that.g = parseFloat(rgba[1]);
    that.b = parseFloat(rgba[2]);
    that.a = parseFloat(rgba[3]);
    return true;
  };

  // Pass it to the XML parser
  initXml(xml);
};

/**
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * A Cylinder element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
ROSLIB.UrdfCylinder = function (options) {
  options = options || {};
  const that = this;
  const xml = options.xml;
  this.type = null;
  this.length = null;
  this.radius = null;

  /**
   * Initialize the element with the given XML node.
   *
   * @param xml - the XML element to parse
   */
  const initXml = function (xml) {
    that.type = ROSLIB.URDF_CYLINDER;
    that.length = parseFloat(xml.getAttribute("length"));
    that.radius = parseFloat(xml.getAttribute("radius"));
  };

  // Pass it to the XML parser
  initXml(xml);
};

/**
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * A Link element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
ROSLIB.UrdfLink = function (options) {
  options = options || {};
  const that = this;
  const xml = options.xml;
  this.name = null;
  this.visual = null;

  /**
   * Initialize the element with the given XML node.
   *
   * @param xml - the XML element to parse
   */
  const initXml = function (xml) {
    that.name = xml.getAttribute("name");
    const visuals = xml.getElementsByTagName("visual");
    if (visuals.length > 0) {
      that.visual = new ROSLIB.UrdfVisual({
        xml: visuals[0],
      });
    }
  };

  // Pass it to the XML parser
  initXml(xml);
};

/**
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * A Material element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
ROSLIB.UrdfMaterial = function (options) {
  options = options || {};
  const that = this;
  const xml = options.xml;
  this.name = null;
  this.textureFilename = null;
  this.color = null;

  /**
   * Initialize the element with the given XML node.
   *
   * @param xml - the XML element to parse
   */
  const initXml = function (xml) {
    that.name = xml.getAttribute("name");

    // Texture
    const textures = xml.getElementsByTagName("texture");
    if (textures.length > 0) {
      that.textureFilename = textures[0].getAttribute("filename");
    }

    // Color
    const colors = xml.getElementsByTagName("color");
    if (colors.length > 0) {
      // Parse the RBGA string
      that.color = new ROSLIB.UrdfColor({
        xml: colors[0],
      });
    }
  };

  // Pass it to the XML parser
  initXml(xml);
};

/**
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * A Mesh element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
ROSLIB.UrdfMesh = function (options) {
  options = options || {};
  const that = this;
  const xml = options.xml;
  this.filename = null;
  this.scale = null;
  this.type = null;

  /**
   * Initialize the element with the given XML node.
   *
   * @param xml - the XML element to parse
   */
  const initXml = function (xml) {
    that.type = ROSLIB.URDF_MESH;
    that.filename = xml.getAttribute("filename");

    // Check for a scale
    const scale = xml.getAttribute("scale");
    if (scale) {
      // Get the XYZ
      const xyz = scale.split(" ");
      that.scale = new ROSLIB.Vector3({
        x: parseFloat(xyz[0]),
        y: parseFloat(xyz[1]),
        z: parseFloat(xyz[2]),
      });
    }
  };

  // Pass it to the XML parser
  initXml(xml);
};

/**
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * A URDF Model can be used to parse a given URDF into the appropriate elements.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 *  * string - the XML element to parse as a string
 */
ROSLIB.UrdfModel = function (options) {
  options = options || {};
  const that = this;
  let xml = options.xml;
  const string = options.string;
  this.materials = [];
  this.links = [];

  /**
   * Initialize the model with the given XML node.
   *
   * @param xml - the XML element to parse
   */
  const initXml = function (xml) {
    // Get the robot tag
    const robotXml = xml.evaluate(
      "//robot",
      xml,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    // Get the robot name
    that.name = robotXml.getAttribute("name");

    // Parse all the visual elements we need
    for (const n in robotXml.childNodes) {
      const node = robotXml.childNodes[n];
      if (node.tagName === "material") {
        const material = new ROSLIB.UrdfMaterial({
          xml: node,
        });
        // Make sure this is unique
        if (that.materials[material.name]) {
          console.warn("Material " + material.name + "is not unique.");
        } else {
          that.materials[material.name] = material;
        }
      } else if (node.tagName === "link") {
        const link = new ROSLIB.UrdfLink({
          xml: node,
        });
        // Make sure this is unique
        if (that.links[link.name]) {
          console.warn("Link " + link.name + " is not unique.");
        } else {
          // Check for a material
          if (link.visual && link.visual.material) {
            if (that.materials[link.visual.material.name]) {
              link.visual.material = that.materials[link.visual.material.name];
            } else if (link.visual.material) {
              that.materials[link.visual.material.name] = link.visual.material;
            }
          }

          // Add the link
          that.links[link.name] = link;
        }
      }
    }
  };

  // Check if we are using a string or an XML element
  if (string) {
    // Parse the string
    const parser = new DOMParser();
    xml = parser.parseFromString(string, "text/xml");
  }
  // Pass it to the XML parser
  initXml(xml);
};

/**
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * A Sphere element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
ROSLIB.UrdfSphere = function (options) {
  options = options || {};
  const that = this;
  const xml = options.xml;
  this.radius = null;
  this.type = null;

  /**
   * Initialize the element with the given XML node.
   *
   * @param xml - the XML element to parse
   */
  const initXml = function (xml) {
    that.type = ROSLIB.URDF_SPHERE;
    that.radius = parseFloat(xml.getAttribute("radius"));
  };

  // pass it to the XML parser
  initXml(xml);
};

/**
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * A Visual element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
ROSLIB.UrdfVisual = function (options) {
  options = options || {};
  const that = this;
  const xml = options.xml;
  this.origin = null;
  this.geometry = null;
  this.material = null;

  /**
   * Initialize the element with the given XML node.
   *
   * @param xml - the XML element to parse
   */
  const initXml = function (xml) {
    // Origin
    const origins = xml.getElementsByTagName("origin");
    if (origins.length === 0) {
      // use the identity as the default
      that.origin = new ROSLIB.Pose();
    } else {
      // Check the XYZ
      let xyz = origins[0].getAttribute("xyz");
      let position = new ROSLIB.Vector3();
      if (xyz) {
        xyz = xyz.split(" ");
        position = new ROSLIB.Vector3({
          x: parseFloat(xyz[0]),
          y: parseFloat(xyz[1]),
          z: parseFloat(xyz[2]),
        });
      }

      // Check the RPY
      let rpy = origins[0].getAttribute("rpy");
      let orientation = new ROSLIB.Quaternion();
      if (rpy) {
        rpy = rpy.split(" ");
        // Convert from RPY
        const roll = parseFloat(rpy[0]);
        const pitch = parseFloat(rpy[1]);
        const yaw = parseFloat(rpy[2]);
        const phi = roll / 2.0;
        const the = pitch / 2.0;
        const psi = yaw / 2.0;
        const x =
          Math.sin(phi) * Math.cos(the) * Math.cos(psi) -
          Math.cos(phi) * Math.sin(the) * Math.sin(psi);
        const y =
          Math.cos(phi) * Math.sin(the) * Math.cos(psi) +
          Math.sin(phi) * Math.cos(the) * Math.sin(psi);
        const z =
          Math.cos(phi) * Math.cos(the) * Math.sin(psi) -
          Math.sin(phi) * Math.sin(the) * Math.cos(psi);
        const w =
          Math.cos(phi) * Math.cos(the) * Math.cos(psi) +
          Math.sin(phi) * Math.sin(the) * Math.sin(psi);

        orientation = new ROSLIB.Quaternion({
          x: x,
          y: y,
          z: z,
          w: w,
        });
        orientation.normalize();
      }
      that.origin = new ROSLIB.Pose({
        position: position,
        orientation: orientation,
      });
    }

    // Geometry
    const geoms = xml.getElementsByTagName("geometry");
    if (geoms.length > 0) {
      let shape = null;
      // Check for the shape
      for (const n in geoms[0].childNodes) {
        const node = geoms[0].childNodes[n];
        if (node.nodeType === 1) {
          shape = node;
          break;
        }
      }
      // Check the type
      const type = shape.nodeName;
      if (type === "sphere") {
        that.geometry = new ROSLIB.UrdfSphere({
          xml: shape,
        });
      } else if (type === "box") {
        that.geometry = new ROSLIB.UrdfBox({
          xml: shape,
        });
      } else if (type === "cylinder") {
        that.geometry = new ROSLIB.UrdfCylinder({
          xml: shape,
        });
      } else if (type === "mesh") {
        that.geometry = new ROSLIB.UrdfMesh({
          xml: shape,
        });
      } else {
        console.warn("Unknown geometry type " + type);
      }
    }

    // Material
    const materials = xml.getElementsByTagName("material");
    if (materials.length > 0) {
      that.material = new ROSLIB.UrdfMaterial({
        xml: materials[0],
      });
    }
  };

  // Pass it to the XML parser
  initXml(xml);
};
