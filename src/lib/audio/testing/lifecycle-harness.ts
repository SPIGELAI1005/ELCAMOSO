export interface AudioLifecycleSnapshot {
  createdNodes: number;
  connectedNodes: number;
  runningSources: number;
}

interface TrackedNodeRecord {
  connections: Set<unknown>;
  source: boolean;
  started: boolean;
  stopped: boolean;
}

function audioParam(initial = 0): AudioParam {
  const param: { value: number } & Record<string, unknown> = {
    value: initial,
    defaultValue: initial,
    minValue: -Infinity,
    maxValue: Infinity,
    automationRate: "a-rate" as const,
  };
  // Define methods after the shape so TypeScript does not require a browser implementation.
  const methods = {
    setValueAtTime(value: number) {
      param.value = value;
      return param as unknown as AudioParam;
    },
    linearRampToValueAtTime(value: number) {
      param.value = value;
      return param as unknown as AudioParam;
    },
    exponentialRampToValueAtTime(value: number) {
      param.value = value;
      return param as unknown as AudioParam;
    },
    setTargetAtTime(value: number) {
      param.value = value;
      return param as unknown as AudioParam;
    },
    cancelScheduledValues() {
      return param as unknown as AudioParam;
    },
    cancelAndHoldAtTime() {
      return param as unknown as AudioParam;
    },
    setValueCurveAtTime() {
      return param as unknown as AudioParam;
    },
  };
  return Object.assign(param, methods) as unknown as AudioParam;
}

export function createAudioLifecycleHarness(sampleRate = 48_000): {
  context: BaseAudioContext;
  destination: AudioNode;
  snapshot: () => AudioLifecycleSnapshot;
  createEngineVoice: () => { dispose: () => void };
} {
  const records: TrackedNodeRecord[] = [];

  const makeNode = (source = false): AudioNode & Record<string, unknown> => {
    const record: TrackedNodeRecord = {
      connections: new Set(),
      source,
      started: false,
      stopped: false,
    };
    const node = {
      connect(destination: unknown) {
        record.connections.add(destination);
        return destination;
      },
      disconnect() {
        record.connections.clear();
      },
      start() {
        record.started = true;
        record.stopped = false;
      },
      stop() {
        record.stopped = true;
      },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return true;
      },
      channelCount: 2,
      channelCountMode: "max",
      channelInterpretation: "speakers",
      numberOfInputs: 1,
      numberOfOutputs: 1,
    } as unknown as AudioNode & Record<string, unknown>;
    records.push(record);
    return node;
  };

  const destination = makeNode(false);
  records.length = 0;

  const context = {
    currentTime: 0,
    sampleRate,
    destination,
    state: "running",
    createGain() {
      return Object.assign(makeNode(), { gain: audioParam(1) }) as unknown as GainNode;
    },
    createOscillator() {
      return Object.assign(makeNode(true), {
        type: "sine",
        frequency: audioParam(440),
        detune: audioParam(0),
      }) as unknown as OscillatorNode;
    },
    createBufferSource() {
      return Object.assign(makeNode(true), {
        buffer: null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        playbackRate: audioParam(1),
        detune: audioParam(0),
      }) as unknown as AudioBufferSourceNode;
    },
    createBiquadFilter() {
      return Object.assign(makeNode(), {
        type: "lowpass",
        frequency: audioParam(350),
        detune: audioParam(0),
        Q: audioParam(1),
        gain: audioParam(0),
      }) as unknown as BiquadFilterNode;
    },
    createBuffer(channels: number, length: number, rate: number) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        duration: length / rate,
        length,
        numberOfChannels: channels,
        sampleRate: rate,
        getChannelData(channel: number) {
          return data[channel]!;
        },
        copyFromChannel() {},
        copyToChannel() {},
      } as unknown as AudioBuffer;
    },
  } as unknown as BaseAudioContext;

  return {
    context,
    destination,
    snapshot: () => ({
      createdNodes: records.length,
      connectedNodes: records.filter((record) => record.connections.size > 0).length,
      runningSources: records.filter((record) => record.source && record.started && !record.stopped)
        .length,
    }),
    createEngineVoice: () => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start();
      return {
        dispose() {
          oscillator.stop();
          oscillator.disconnect();
          gain.disconnect();
        },
      };
    },
  };
}
