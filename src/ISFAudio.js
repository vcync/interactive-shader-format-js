/* eslint-env worker browser */

// WebAudio globals for resource management
let audioContext;
const streams = {
  // deviceId: MediaStream
};

let audioTextureId = 0;
const audioTextureInstances = [];

function addAudioTextureInstance(audioTextureInstance) {
  audioTextureInstances[audioTextureId] = audioTextureInstance;
  audioTextureId += 1;

  return audioTextureId - 1;
}

function removeAudioTextureInstance(id) {
  delete audioTextureInstances[id];
}

function updateAudioTextureInstances(updateFrequency, updateTimeDomain) {
  Object.values(audioTextureInstances).forEach((audioTextureInstance) => {
    audioTextureInstance.update(updateFrequency, updateTimeDomain);
  });
}

// eslint-disable-next-line no-restricted-globals
const couldBeWorker = self.document === undefined;

function ISFAudio(args) {
  const options = {
    deviceId: undefined,
    fftSize: 2048,
    useWebAudio: true,
    ...args,
  };

  this.audioTextureInstances = audioTextureInstances;
  this.useWebAudio = options.useWebAudio;

  const { fftSize, useWebAudio, deviceId } = options;

  const halfFftSize = fftSize / 2;

  this.lastUpdate = 0;
  this.fftSize = fftSize;
  this.halfFftSize = halfFftSize;

  this.frequencyValuesL = new Uint8Array(fftSize);
  this.frequencyValuesR = new Uint8Array(fftSize);
  this.timeDomainValuesL = new Uint8Array(halfFftSize);
  this.timeDomainValuesR = new Uint8Array(halfFftSize);

  if (couldBeWorker || !useWebAudio) {
    if (couldBeWorker) {
      console.warn(
        // eslint-disable-next-line max-len
        "WebAudio is unavailable in a WebWorker. Please update renderer.audio.setFrequencyValues() and renderer.audio.setTimeDomainValues() with the approprate data to use ISF audio features."
      );
    }

    return;
  }

  if (useWebAudio) {
    this.setUpWebAudio({ deviceId, fftSize });
  }
}

ISFAudio.prototype.setUpWebAudio = async function setUpWebAudio({
  deviceId,
  fftSize,
}) {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: "interactive",
    });
  }

  this.audioContext = audioContext;
  this.analyserNodeL = this.audioContext.createAnalyser();
  this.analyserNodeR = this.audioContext.createAnalyser();

  this.analyserNodeL.smoothingTimeConstant = 0;
  this.analyserNodeR.smoothingTimeConstant = 0;
  this.analyserNodeL.fftSize = fftSize;
  this.analyserNodeR.fftSize = fftSize;

  // this brings the fft analysis in-line to what we'd expect from other non-web applications
  // not sure if this is opinionated or not, just trying to match the output from ISFEditor for mac
  // and a few other apps
  this.analyserNodeL.maxDecibels = 0;
  this.analyserNodeL.minDecibels = -61;
  this.analyserNodeR.maxDecibels = 0;
  this.analyserNodeR.minDecibels = -61;

  let defaultDevice;

  if (!deviceId) {
    const devices = await navigator.mediaDevices.enumerateDevices();
    defaultDevice = devices
      .filter((device) => device.kind === "audioinput")
      .find((device) => device.label.toLocaleLowerCase().indexOf("default"));
  }

  const resolvedDeviceId = deviceId || defaultDevice.deviceId;
  let stream;

  if (resolvedDeviceId && streams[resolvedDeviceId]) {
    console.log("reusing stream");
    stream = streams[resolvedDeviceId];
  } else {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: resolvedDeviceId,
        },
      });
    } catch (e) {
      console.error(e);
    }

    streams[resolvedDeviceId] = stream;
  }

  // always try to resume
  // it seems browsers (chrome/firefox) count getUserMedia permissions acceptance
  // as a user interaction
  audioContext.resume();

  const splitterNode = audioContext.createChannelSplitter(2);
  audioContext.createMediaStreamSource(stream).connect(splitterNode);

  splitterNode.connect(this.analyserNodeL, 0);
  splitterNode.connect(this.analyserNodeR, 1);
};

ISFAudio.prototype.setFrequencyValues = function setFrequencyValues(
  frequencyValuesL,
  frequencyValuesR
) {
  this.frequencyValuesL = frequencyValuesL;
  this.frequencyValuesR = frequencyValuesR;

  updateAudioTextureInstances(true, false);
};

ISFAudio.prototype.setTimeDomainValues = function setTimeDomainValues(
  timeDomainValuesL,
  timeDomainValuesR
) {
  this.timeDomainValuesL = timeDomainValuesL;
  this.timeDomainValuesR = timeDomainValuesR;

  updateAudioTextureInstances(false, true);
};

ISFAudio.prototype.updateWebAudio = function updateWebAudio() {
  const currentTime = Date.now();

  if (!this.useWebAudio || this.lastUpdate >= currentTime) {
    return;
  }

  this.analyserNodeL.getByteFrequencyData(this.frequencyValuesL);
  this.analyserNodeL.getByteTimeDomainData(this.timeDomainValuesL);

  this.analyserNodeR.getByteFrequencyData(this.frequencyValuesR);
  this.analyserNodeR.getByteTimeDomainData(this.timeDomainValuesR);

  updateAudioTextureInstances(true, true);
  this.lastUpdate = currentTime;
};

ISFAudio.prototype.destroy = function destroy() {
  // clean up stuff
};

function ISFAudioTexture(isfAudioInstance, type = "audioFFT", maxSamples) {
  this.isfAudioInstance = isfAudioInstance;
  this.maxSamples = maxSamples | this.isfAudioInstance.fftSize;
  this.type = type;

  const { fftSize, halfFftSize } = isfAudioInstance;

  const canvas = couldBeWorker
    ? new OffscreenCanvas(fftSize, 1)
    : document.createElement("canvas");

  this.context = canvas.getContext("2d");

  if (!couldBeWorker) {
    canvas.width = type === "audioFFT" ? fftSize : halfFftSize;
    canvas.height = 2;
  }

  this.id = addAudioTextureInstance(this);
}

ISFAudioTexture.prototype.update = function update() {
  const {
    frequencyValuesL,
    timeDomainValuesL,
    frequencyValuesR,
    timeDomainValuesR,
  } = this.isfAudioInstance;

  let imageDataUInt8;
  let imageDataLength;

  if (this.type === "audioFFT") {
    // Construct FFT image data
    const frequencyImageData = [
      ...frequencyValuesR,
      ...frequencyValuesL,
    ].reduce((arr, value) => {
      arr.push(value, value, value, 255);
      return arr;
    }, []);

    imageDataUInt8 = Uint8ClampedArray.from(frequencyImageData);
    imageDataLength = frequencyValuesL.length;
  }

  if (this.type === "audio") {
    // Construct waveform image data
    const timeDomainImageData = [
      ...timeDomainValuesR,
      ...timeDomainValuesL,
    ].reduce((arr, value) => {
      arr.push(value, value, value, 255);
      return arr;
    }, []);

    imageDataUInt8 = Uint8ClampedArray.from(timeDomainImageData);
    imageDataLength = timeDomainValuesL.length;
  }

  this.context.putImageData(
    new ImageData(imageDataUInt8, imageDataLength),
    0,
    0
  );
};

ISFAudioTexture.prototype.destroy = function destroy() {
  removeAudioTextureInstance(this.id);
};

export { ISFAudio, ISFAudioTexture };
