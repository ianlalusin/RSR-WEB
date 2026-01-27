import { Barangay } from "./types";

export const mockBarangays: Barangay[] = [
  {
    id: "brgy-001",
    name: "San Antonio",
    districtId: "dist-01",
    districtName: "North District",
    population: 15203,
    votingPopulation: 8904,
    rsrVotes: 5520,
    favoredVotePct: 62.0,
    isWin: true,
    congVisitCount: 3,
    createdAt: new Date() as any,
    updatedAt: new Date() as any,
  },
  {
    id: "brgy-002",
    name: "Poblacion",
    districtId: "dist-02",
    districtName: "Urban District",
    population: 22450,
    votingPopulation: 15100,
    rsrVotes: 7278,
    favoredVotePct: 48.2,
    isWin: false,
    congVisitCount: 5,
    createdAt: new Date() as any,
    updatedAt: new Date() as any,
  },
];
