
export interface Vector2D {
  x: number;
  y: number;
}

export interface SimulationState {
  initialVelocity: number; // m/s
  initialHeight: number;   // m
  mass: number;            // kg
  isPaused: boolean;
  time: number;            // s
  isRunning: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface StoredSimulationResult {
  trajectory: Point[];
  finalPos: Point;
  vx: number;
  vy: number;
  vResultant: number;
  Fg: number;
  Fi_y: number;
  mass: number;
  initialParams: {
    v0: number;
    h: number;
    m: number;
  };
}