import { createSlice } from "@reduxjs/toolkit";
import { normalizeAppliedJob, normalizeJob } from "../utils/jobData";

const jobSlice = createSlice({
    name:"job",
    initialState:{
        allJobs:[],
        allAdminJobs:[],
        singleJob:null, 
        searchJobByText:"",
        allAppliedJobs:[],
        searchedQuery:"",
    },
    reducers:{
        // actions
        setAllJobs:(state,action) => {
            state.allJobs = action.payload.map(normalizeJob);
        },
        setSingleJob:(state,action) => {
            state.singleJob = normalizeJob(action.payload);
        },
        setAllAdminJobs:(state,action) => {
            state.allAdminJobs = action.payload.map(normalizeJob);
        },
        setSearchJobByText:(state,action) => {
            state.searchJobByText = action.payload;
        },
        setAllAppliedJobs:(state,action) => {
            state.allAppliedJobs = action.payload.map(normalizeAppliedJob);
        },
        setSearchedQuery:(state,action) => {
            state.searchedQuery = action.payload;
        }
    }
});
export const {
    setAllJobs, 
    setSingleJob, 
    setAllAdminJobs,
    setSearchJobByText, 
    setAllAppliedJobs,
    setSearchedQuery
} = jobSlice.actions;
export default jobSlice.reducer;