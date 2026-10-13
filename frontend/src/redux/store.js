import { combineReducers, configureStore } from "@reduxjs/toolkit";

import authSlice from "./authSlice";
import jobSlice from "./jobSlice";
import applicationSlice from "./applicationSlice";
import { normalizeAppliedJob, normalizeJob } from "../utils/jobData";

import {
    persistReducer,
    FLUSH,
    REHYDRATE,
    PAUSE,
    PERSIST,
    PURGE,
    REGISTER,
} from "redux-persist";

// Custom storage using browser localStorage
const storage = {
    getItem: (key) => Promise.resolve(localStorage.getItem(key)),
    setItem: (key, value) => Promise.resolve(localStorage.setItem(key, value)),
    removeItem: (key) => Promise.resolve(localStorage.removeItem(key)),
};

const migratePersistedJobs = async (state) => {
    if (!state?.job) {
        return state;
    }

    return {
        ...state,
        job: {
            ...state.job,
            allJobs: state.job.allJobs?.map(normalizeJob),
            allAdminJobs: state.job.allAdminJobs?.map(normalizeJob),
            singleJob: normalizeJob(state.job.singleJob),
            allAppliedJobs: state.job.allAppliedJobs?.map(normalizeAppliedJob),
        },
    };
};

const persistConfig = {
    key: "root",
    version: 2,
    storage,
    migrate: migratePersistedJobs,
};

const rootReducer = combineReducers({
    auth: authSlice,
    job: jobSlice,
    application: applicationSlice,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
    reducer: persistedReducer,

    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [
                    FLUSH,
                    REHYDRATE,
                    PAUSE,
                    PERSIST,
                    PURGE,
                    REGISTER,
                ],
            },
        }),
});

export default store;