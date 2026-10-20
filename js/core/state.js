import { Group } from "tween";

// Shared references live outside the entry point, so imports never start an app.
export const state = {
  app: null,
  sceneManager: null,
  applicatorObject: null,
  lenis: null,
  tweens: new Group(),
};
export const setApplicatorObject = (object) => {
  state.applicatorObject = object;
};
