export type KalmanParams = {
  processNoise: number;
  measurementNoise: number;
  estimatedError: number;
};

export class KalmanFilter1D {
  private estimate: number;
  private error: number;
  private readonly processNoise: number;
  private readonly measurementNoise: number;

  constructor(initialValue: number, params: KalmanParams) {
    this.estimate = initialValue;
    this.error = params.estimatedError;
    this.processNoise = params.processNoise;
    this.measurementNoise = params.measurementNoise;
  }

  update(measurement: number): number {
    this.error += this.processNoise;
    const gain = this.error / (this.error + this.measurementNoise);
    this.estimate += gain * (measurement - this.estimate);
    this.error = (1 - gain) * this.error;
    return this.estimate;
  }

  set(value: number): void {
    this.estimate = value;
  }
}
