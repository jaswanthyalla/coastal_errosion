import { configureStore } from "@reduxjs/toolkit";

export const store = configureStore({
  reducer: {
    app: (state = {}) => state, // dummy reducer to fix console warning
  }
});

export default store;
