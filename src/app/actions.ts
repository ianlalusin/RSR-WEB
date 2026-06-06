'use server';

import {
  generateBarangayProfiles as generateBarangayProfilesFlow,
  type GenerateBarangayProfilesInput,
} from '@/ai/flows/generate-barangay-profiles';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ProjectRecord, Barangay, BarangayCycle, BarangayCycleStats, CaptainProfile, UserProfile, Department, Role, MedicalRecord, Hospital, RequestRecord, RequestStatus, TaskRecord, TaskStatus } from '@/lib/types';
import type {
  ScholarshipApplication,
  ScholarshipSex,
  ScholarshipCivilStatus,
  ScholarshipRelationship,
  ScholarshipIncomeBracket,
  ScholarshipYearLevel,
} from '@/lib/types/scholarship';
import { evaluateShortlist, OTHER_SCHOOL_VALUE, OTHER_COURSE_VALUE } from '@/lib/scholarship-schools';
import { canViewPage, canDo } from '@/lib/access';
import { logAudit } from '@/lib/audit';
import { assertActor, type VerifiedActor } from '@/lib/server-auth';
import { randomBytes } from 'crypto';
import { z } from 'zod';

type ActorToken = string;

async function resolveActor(token: ActorToken): Promise<VerifiedActor> {
  return assertActor(token);
}

export async function generateBarangayProfiles(input: GenerateBarangayProfilesInput, actorToken: ActorToken) {
  try {
    const actor = await resolveActor(actorToken);
    const result = await generateBarangayProfilesFlow(input);

    await logAudit({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: 'generate_ai_profile',
      entityType: 'barangay',
      entityId: input.barangayName,
      details: { input, profileCount: result.profiles.length }
    });

    if (!result || !result.profiles) {
      throw new Error("AI failed to generate profiles.");
    }
    return { success: true, data: result.profiles };
  } catch (error) {
    console.error('Error generating barangay profiles:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, error: `Failed to generate profiles: ${errorMessage}` };
  }
}

export interface AddBarangayInput {
    name: string;
    districtId: string;
    districtName: string;
    population: number;
    congVisitCount?: number;
    coordinatorUids?: string[];
    cycleYear: string;
    cycleStats: BarangayCycleStats;
}

function buildListItem(brgy: { name: string; districtId: string; districtName: string; population: number }, cycleYear: string, stats: BarangayCycleStats) {
    return {
        name: brgy.name,
        districtId: brgy.districtId,
        districtName: brgy.districtName,
        population: brgy.population,
        currentCycle: cycleYear,
        votingPopulation: stats.votingPopulation,
        rsrVotes: stats.rsrVotes,
        favoredVotePct: stats.favoredVotePct,
        isWin: stats.isWin,
    };
}

export async function addBarangay(data: AddBarangayInput, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const batch = adminDb.batch();
        const newBrgyRef = adminDb.collection('barangays').doc();

        batch.set(newBrgyRef, {
            name: data.name,
            districtId: data.districtId,
            districtName: data.districtName,
            population: data.population,
            congVisitCount: data.congVisitCount ?? 0,
            coordinatorUids: data.coordinatorUids ?? [],
            currentCycle: data.cycleYear,
            currentStats: data.cycleStats,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        const cycleRef = newBrgyRef.collection('cycles').doc(data.cycleYear);
        batch.set(cycleRef, {
            year: data.cycleYear,
            ...data.cycleStats,
            captain: { name: '' },
            secretary: {},
            councilors: [],
            createdAt: FieldValue.serverTimestamp(),
            createdByUid: actor.uid,
            createdByEmail: actor.email,
            updatedAt: FieldValue.serverTimestamp(),
            updatedByUid: actor.uid,
            updatedByEmail: actor.email,
        });

        const listDocRef = adminDb.collection('lists').doc('barangays');
        batch.set(listDocRef, {
            barangays: {
                [newBrgyRef.id]: buildListItem(data, data.cycleYear, data.cycleStats),
            }
        }, { merge: true });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'barangay',
            entityId: newBrgyRef.id,
            districtId: data.districtId,
            details: data,
        });

        await batch.commit();
        return { success: true, id: newBrgyRef.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export type UpdateBarangayInput = Partial<Pick<Barangay, 'name' | 'districtId' | 'districtName' | 'population' | 'congVisitCount' | 'coordinatorUids'>>;

export async function updateBarangay(id: string, data: UpdateBarangayInput, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const batch = adminDb.batch();
        const brgyDoc = adminDb.collection('barangays').doc(id);

        batch.update(brgyDoc, {
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
        });

        const listUpdateData: Record<string, any> = {};
        if (data.name !== undefined) listUpdateData[`barangays.${id}.name`] = data.name;
        if (data.districtId !== undefined) listUpdateData[`barangays.${id}.districtId`] = data.districtId;
        if (data.districtName !== undefined) listUpdateData[`barangays.${id}.districtName`] = data.districtName;
        if (data.population !== undefined) listUpdateData[`barangays.${id}.population`] = data.population;

        if (Object.keys(listUpdateData).length > 0) {
            const listDocRef = adminDb.collection('lists').doc('barangays');
            batch.update(listDocRef, listUpdateData);
        }

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'barangay',
            entityId: id,
            details: data,
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteBarangay(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const batch = adminDb.batch();
        const brgyDoc = adminDb.collection('barangays').doc(id);
        batch.delete(brgyDoc);

        const listDocRef = adminDb.collection('lists').doc('barangays');
        batch.update(listDocRef, {
            [`barangays.${id}`]: FieldValue.delete()
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'delete',
            entityType: 'barangay',
            entityId: id,
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function bulkAddBarangays(data: AddBarangayInput[], actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const batch = adminDb.batch();

        const listUpdates: Record<string, any> = {};

        data.forEach(brgyData => {
            const docRef = adminDb.collection('barangays').doc();
            batch.set(docRef, {
                name: brgyData.name,
                districtId: brgyData.districtId,
                districtName: brgyData.districtName,
                population: brgyData.population,
                congVisitCount: brgyData.congVisitCount ?? 0,
                coordinatorUids: brgyData.coordinatorUids ?? [],
                currentCycle: brgyData.cycleYear,
                currentStats: brgyData.cycleStats,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            const cycleRef = docRef.collection('cycles').doc(brgyData.cycleYear);
            batch.set(cycleRef, {
                year: brgyData.cycleYear,
                ...brgyData.cycleStats,
                captain: { name: '' },
                secretary: {},
                councilors: [],
                createdAt: FieldValue.serverTimestamp(),
                createdByUid: actor.uid,
                createdByEmail: actor.email,
                updatedAt: FieldValue.serverTimestamp(),
                updatedByUid: actor.uid,
                updatedByEmail: actor.email,
            });

            listUpdates[docRef.id] = buildListItem(brgyData, brgyData.cycleYear, brgyData.cycleStats);
        });

        const listDocRef = adminDb.collection('lists').doc('barangays');
        batch.set(listDocRef, { barangays: listUpdates }, { merge: true });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'bulk_update',
            entityType: 'system',
            entityId: 'barangays_collection',
            details: { operation: 'bulkAddBarangays', count: data.length },
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export type UpsertCycleInput = Partial<{
    votingPopulation: number;
    rsrVotes: number;
    favoredVotePct: number;
    isWin: boolean;
    captain: BarangayCycle['captain'];
    secretary: BarangayCycle['secretary'];
    councilors: BarangayCycle['councilors'];
}>;

export async function upsertBarangayCycle(brgyId: string, year: string, data: UpsertCycleInput, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const batch = adminDb.batch();

        const brgyRef = adminDb.collection('barangays').doc(brgyId);
        const cycleRef = brgyRef.collection('cycles').doc(year);

        const brgySnap = await brgyRef.get();
        if (!brgySnap.exists) {
            return { success: false, error: 'Barangay not found.' };
        }
        const brgyData = brgySnap.data() as Barangay;
        const cycleSnap = await cycleRef.get();
        const isCreating = !cycleSnap.exists;

        const updateData: Record<string, any> = {
            ...data,
            year,
            updatedAt: FieldValue.serverTimestamp(),
            updatedByUid: actor.uid,
            updatedByEmail: actor.email,
        };

        if (isCreating) {
            batch.set(cycleRef, {
                votingPopulation: 0,
                rsrVotes: 0,
                favoredVotePct: 0,
                isWin: false,
                captain: { name: '' },
                secretary: {},
                councilors: [],
                ...updateData,
                createdAt: FieldValue.serverTimestamp(),
                createdByUid: actor.uid,
                createdByEmail: actor.email,
            });
        } else {
            batch.update(cycleRef, updateData);
        }

        const touchedStats = data.votingPopulation !== undefined || data.rsrVotes !== undefined || data.favoredVotePct !== undefined || data.isWin !== undefined;
        if (touchedStats && brgyData.currentCycle === year) {
            const existing = (cycleSnap.exists ? cycleSnap.data() : {}) as Partial<BarangayCycle>;
            const nextStats: BarangayCycleStats = {
                votingPopulation: data.votingPopulation ?? existing.votingPopulation ?? 0,
                rsrVotes: data.rsrVotes ?? existing.rsrVotes ?? 0,
                favoredVotePct: data.favoredVotePct ?? existing.favoredVotePct ?? 0,
                isWin: data.isWin ?? existing.isWin ?? false,
            };
            batch.update(brgyRef, {
                currentStats: nextStats,
                updatedAt: FieldValue.serverTimestamp(),
            });
            const listDocRef = adminDb.collection('lists').doc('barangays');
            batch.update(listDocRef, {
                [`barangays.${brgyId}.votingPopulation`]: nextStats.votingPopulation,
                [`barangays.${brgyId}.rsrVotes`]: nextStats.rsrVotes,
                [`barangays.${brgyId}.favoredVotePct`]: nextStats.favoredVotePct,
                [`barangays.${brgyId}.isWin`]: nextStats.isWin,
                [`barangays.${brgyId}.currentCycle`]: year,
            });
        }

        await batch.commit();

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: isCreating ? 'create' : 'update',
            entityType: 'barangayCycle',
            entityId: `${brgyId}/${year}`,
            details: { year, ...data },
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function setCurrentCycle(brgyId: string, year: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);

        const brgyRef = adminDb.collection('barangays').doc(brgyId);
        const cycleRef = brgyRef.collection('cycles').doc(year);
        const cycleSnap = await cycleRef.get();
        if (!cycleSnap.exists) {
            return { success: false, error: 'Cycle does not exist for this barangay.' };
        }
        const cycle = cycleSnap.data() as BarangayCycle;
        const stats: BarangayCycleStats = {
            votingPopulation: cycle.votingPopulation ?? 0,
            rsrVotes: cycle.rsrVotes ?? 0,
            favoredVotePct: cycle.favoredVotePct ?? 0,
            isWin: cycle.isWin ?? false,
        };

        const batch = adminDb.batch();
        batch.update(brgyRef, {
            currentCycle: year,
            currentStats: stats,
            updatedAt: FieldValue.serverTimestamp(),
        });

        const listDocRef = adminDb.collection('lists').doc('barangays');
        batch.update(listDocRef, {
            [`barangays.${brgyId}.currentCycle`]: year,
            [`barangays.${brgyId}.votingPopulation`]: stats.votingPopulation,
            [`barangays.${brgyId}.rsrVotes`]: stats.rsrVotes,
            [`barangays.${brgyId}.favoredVotePct`]: stats.favoredVotePct,
            [`barangays.${brgyId}.isWin`]: stats.isWin,
        });

        await batch.commit();

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'barangay',
            entityId: brgyId,
            details: { action: 'setCurrentCycle', year },
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


export async function updateUserAccess(uid: string, data: Partial<UserProfile>, actorToken: ActorToken, originalData: Partial<UserProfile>) {
    try {
        const actor = await resolveActor(actorToken);
        const userDoc = adminDb.collection('users').doc(uid);
        await userDoc.update({ ...data, updatedAt: FieldValue.serverTimestamp() });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'access_update',
            entityType: 'user',
            entityId: uid,
            details: { before: originalData, after: data },
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateSelfProfile(uid: string, data: { displayName: string, photoURL: string }, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        if (actor.uid !== uid) {
            return { success: false, error: 'Permission denied. You can only update your own profile.' };
        }

        const userDoc = adminDb.collection('users').doc(uid);
        await userDoc.update({
            displayName: data.displayName,
            photoURL: data.photoURL,
            updatedAt: FieldValue.serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'user',
            entityId: uid,
            details: { self_profile_update: data },
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Legacy entry point — routes captain/secretary/councilors updates into the
 * current cycle subcollection. New callers should use `upsertBarangayCycle`.
 */
export async function updateCaptainProfile(brgyId: string, _isCreating: boolean, data: Partial<Omit<CaptainProfile, 'createdAt'>>, actorToken: ActorToken) {
    try {
        const brgySnap = await adminDb.collection('barangays').doc(brgyId).get();
        if (!brgySnap.exists) return { success: false, error: 'Barangay not found.' };
        const currentCycle = (brgySnap.data() as Barangay).currentCycle;
        if (!currentCycle) return { success: false, error: 'No current cycle set for this barangay.' };

        const cycleUpdate: UpsertCycleInput = {};
        if (data.captain !== undefined) cycleUpdate.captain = data.captain as BarangayCycle['captain'];
        if (data.secretary !== undefined) cycleUpdate.secretary = data.secretary;
        if (data.councilors !== undefined) cycleUpdate.councilors = data.councilors;

        return upsertBarangayCycle(brgyId, currentCycle, cycleUpdate, actorToken);
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

type AddProjectData = Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid'>;

export async function addProjectRecord(data: AddProjectData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newRecordRef = adminDb.collection('projectRecords').doc();
        await newRecordRef.set({
            ...data,
            createdByUid: actor.uid,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'projectRecord',
            entityId: newRecordRef.id,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateProjectRecord(id: string, data: Partial<Omit<ProjectRecord, 'id'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const recordDoc = adminDb.collection('projectRecords').doc(id);
        await recordDoc.update({
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'projectRecord',
            entityId: id,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteProjectRecord(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('projectRecords').doc(id).delete();

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'delete',
            entityType: 'projectRecord',
            entityId: id,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

type AddDepartmentData = Omit<Department, 'id' | 'createdAt' | 'updatedAt'>;

export async function addDepartment(data: AddDepartmentData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newDeptId = adminDb.collection('_').doc().id;
        const listDocRef = adminDb.collection('lists').doc('departments');

        const newItemData = {
            ...data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        await listDocRef.set({
            departments: { [newDeptId]: newItemData }
        }, { merge: true });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'department',
            entityId: newDeptId,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateDepartment(id: string, data: Partial<Omit<Department, 'id' | 'createdAt' | 'updatedAt'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('departments');

        const updatePayload: Record<string, any> = {
            [`departments.${id}.updatedAt`]: FieldValue.serverTimestamp()
        };
        if (data.name !== undefined) updatePayload[`departments.${id}.name`] = data.name;
        if (data.description !== undefined) updatePayload[`departments.${id}.description`] = data.description;
        if (data.pageVisibility !== undefined) updatePayload[`departments.${id}.pageVisibility`] = data.pageVisibility;

        await listDocRef.update(updatePayload);

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'department',
            entityId: id,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteDepartment(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('departments');
        await listDocRef.update({ [`departments.${id}`]: FieldValue.delete() });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'delete',
            entityType: 'department',
            entityId: id,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


type AddRoleData = { name: string };

export async function addRole(data: AddRoleData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newRoleId = adminDb.collection('_').doc().id;
        const listDocRef = adminDb.collection('lists').doc('roles');

        const newItemData = {
            name: data.name,
            rank: 20,
            scopeBreadth: 'own_districts',
            isBuiltIn: false,
            status: 'active',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        await listDocRef.set({ roles: { [newRoleId]: newItemData } }, { merge: true });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'role',
            entityId: newRoleId,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateRole(id: string, data: Partial<Omit<Role, 'id' | 'createdAt' | 'updatedAt'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('roles');

        const snap = await listDocRef.get();
        const existing = snap.exists ? (snap.data() as any)?.roles?.[id] : null;
        if (existing?.isBuiltIn && (data.rank !== undefined || data.scopeBreadth !== undefined || data.isBuiltIn !== undefined)) {
            throw new Error('Cannot change rank, scopeBreadth, or isBuiltIn on a built-in role.');
        }

        const updatePayload: Record<string, any> = {
            [`roles.${id}.updatedAt`]: FieldValue.serverTimestamp()
        };
        if (data.name !== undefined) updatePayload[`roles.${id}.name`] = data.name;
        if (data.rank !== undefined && !existing?.isBuiltIn) updatePayload[`roles.${id}.rank`] = data.rank;
        if (data.scopeBreadth !== undefined && !existing?.isBuiltIn) updatePayload[`roles.${id}.scopeBreadth`] = data.scopeBreadth;
        if (data.status !== undefined) updatePayload[`roles.${id}.status`] = data.status;
        if (data.preset !== undefined) updatePayload[`roles.${id}.preset`] = data.preset;

        await listDocRef.update(updatePayload);

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'role',
            entityId: id,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteRole(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('roles');

        const snap = await listDocRef.get();
        const existing = snap.exists ? (snap.data() as any)?.roles?.[id] : null;
        if (existing?.isBuiltIn) throw new Error('Built-in roles cannot be deleted.');

        await listDocRef.update({ [`roles.${id}`]: FieldValue.delete() });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'delete',
            entityType: 'role',
            entityId: id,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

type AddMedicalRecordData = Omit<MedicalRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'projectId'>;

export async function addMedicalRecord(data: AddMedicalRecordData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newRecordRef = adminDb.collection('medicalRecords').doc();

        const projectId = `MED-${newRecordRef.id.substring(0, 8).toUpperCase()}`;

        await newRecordRef.set({
            ...data,
            projectId,
            createdByUid: actor.uid,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'medicalRecord',
            entityId: newRecordRef.id,
            districtId: data.districtId,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateMedicalRecord(id: string, data: Partial<Omit<MedicalRecord, 'id'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const recordDoc = adminDb.collection('medicalRecords').doc(id);
        await recordDoc.update({
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'medicalRecord',
            entityId: id,
            districtId: data.districtId,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteMedicalRecord(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('medicalRecords').doc(id).delete();

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'delete',
            entityType: 'medicalRecord',
            entityId: id,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

type AddHospitalData = Omit<Hospital, 'id' | 'createdAt' | 'updatedAt'>;

export async function addHospital(data: AddHospitalData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newId = adminDb.collection('_').doc().id;
        const listDocRef = adminDb.collection('lists').doc('hospitals');
        const newItemData = { ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
        await listDocRef.set({ hospitals: { [newId]: newItemData } }, { merge: true });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'create', entityType: 'hospital', entityId: newId, details: data });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateHospital(id: string, data: Partial<Omit<Hospital, 'id' | 'createdAt' | 'updatedAt'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('hospitals');
        const updatePayload: Record<string, any> = { [`hospitals.${id}.updatedAt`]: FieldValue.serverTimestamp() };
        if (data.name !== undefined) updatePayload[`hospitals.${id}.name`] = data.name;
        if (data.address !== undefined) updatePayload[`hospitals.${id}.address`] = data.address;
        await listDocRef.update(updatePayload);
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'update', entityType: 'hospital', entityId: id, details: data });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteHospital(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const listDocRef = adminDb.collection('lists').doc('hospitals');
        await listDocRef.update({ [`hospitals.${id}`]: FieldValue.delete() });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'delete', entityType: 'hospital', entityId: id });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ---- Request / Receiving Actions ----

type AddRequestData = Omit<RequestRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'status' | 'reviewNotes' | 'reviewedByUid' | 'reviewedAt'>;

export async function addRequest(data: AddRequestData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newRef = adminDb.collection('requests').doc();
        await newRef.set({
            ...data,
            status: 'pending' as RequestStatus,
            createdByUid: actor.uid,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'create', entityType: 'request', entityId: newRef.id, districtId: data.districtId });
        return { success: true, id: newRef.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateRequest(id: string, data: Partial<Omit<RequestRecord, 'id'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const docRef = adminDb.collection('requests').doc(id);
        await docRef.update({ ...data, updatedAt: FieldValue.serverTimestamp() });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'update', entityType: 'request', entityId: id });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteRequest(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('requests').doc(id).delete();
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'delete', entityType: 'request', entityId: id });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateRequestStatus(
    id: string,
    newStatus: RequestStatus,
    actorToken: ActorToken,
    reviewNotes?: string
) {
    try {
        const actor = await resolveActor(actorToken);
        const docRef = adminDb.collection('requests').doc(id);
        const updateData: Record<string, any> = {
            status: newStatus,
            updatedAt: FieldValue.serverTimestamp(),
        };
        if (newStatus === 'approved' || newStatus === 'rejected') {
            updateData.reviewedByUid = actor.uid;
            updateData.reviewedAt = FieldValue.serverTimestamp();
            if (reviewNotes) updateData.reviewNotes = reviewNotes;
        }
        if (newStatus === 'pending') {
            updateData.reviewedByUid = null;
            updateData.reviewedAt = null;
            updateData.reviewNotes = null;
        }
        await docRef.update(updateData);
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'status_change', entityType: 'request', entityId: id, details: { newStatus, reviewNotes } });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ---- Tasker Actions ----

type AddTaskData = Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'>;

export async function addTask(data: AddTaskData, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        const newRef = adminDb.collection('tasks').doc();
        await newRef.set({
            ...data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'create', entityType: 'task', entityId: newRef.id });
        return { success: true, id: newRef.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateTask(id: string, data: Partial<Omit<TaskRecord, 'id'>>, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('tasks').doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'update', entityType: 'task', entityId: id });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateTaskStatus(id: string, newStatus: TaskStatus, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('tasks').doc(id).update({ status: newStatus, updatedAt: FieldValue.serverTimestamp() });
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'status_change', entityType: 'task', entityId: id, details: { newStatus } });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteTask(id: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        await adminDb.collection('tasks').doc(id).delete();
        await logAudit({ actorUid: actor.uid, actorEmail: actor.email, action: 'delete', entityType: 'task', entityId: id });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ============================================================================
// Scholarship — Recto Tulong Dunong
// ============================================================================

const SEX_VALUES: ScholarshipSex[] = ['Male', 'Female', 'Prefer not to say'];
const CIVIL_STATUS_VALUES: ScholarshipCivilStatus[] = ['Single', 'Married', 'Widowed', 'Separated'];
const RELATIONSHIP_VALUES: ScholarshipRelationship[] = ['Mother', 'Father', 'Guardian', 'Sibling', 'Spouse', 'Other'];
const INCOME_BRACKET_VALUES: ScholarshipIncomeBracket[] = [
    'Below ₱10,000',
    '₱10,000–₱20,000',
    '₱20,001–₱40,000',
    '₱40,001–₱80,000',
    'Above ₱80,000',
];
const YEAR_LEVEL_VALUES: ScholarshipYearLevel[] = [
    'Incoming 1st Year', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Graduating',
];

const scholarshipApplicationSchema = z.object({
    lastName: z.string().trim().min(1, 'Last name is required.').max(100),
    firstName: z.string().trim().min(1, 'First name is required.').max(100),
    middleName: z.string().trim().max(100).optional().default(''),
    suffix: z.string().trim().max(20).optional().default(''),
    dateOfBirth: z.string().trim().min(1, 'Date of birth is required.'),
    sex: z.enum(SEX_VALUES as [ScholarshipSex, ...ScholarshipSex[]]),
    civilStatus: z.enum(CIVIL_STATUS_VALUES as [ScholarshipCivilStatus, ...ScholarshipCivilStatus[]]),

    homeAddress: z.string().trim().min(1, 'Home address is required.').max(300),
    city: z.string().trim().min(1, 'City/Municipality is required.').max(100),
    province: z.string().trim().min(1, 'Province is required.').max(100),
    postalCode: z.string().trim().max(20).optional().default(''),
    mobile: z.string().trim().min(1, 'Mobile number is required.').max(30),
    email: z.string().trim().email('A valid email is required.').max(200),

    parentName: z.string().trim().min(1, 'Parent/Guardian name is required.').max(200),
    parentRelationship: z.enum(RELATIONSHIP_VALUES as [ScholarshipRelationship, ...ScholarshipRelationship[]]),
    parentContact: z.string().trim().min(1, 'Parent/Guardian contact number is required.').max(30),
    incomeBracket: z.enum(INCOME_BRACKET_VALUES as [ScholarshipIncomeBracket, ...ScholarshipIncomeBracket[]]),

    school: z.string().trim().min(1, 'School is required.'),
    schoolOther: z.string().trim().max(200).optional().default(''),
    course: z.string().trim().min(1, 'Course is required.'),
    courseOther: z.string().trim().max(200).optional().default(''),
    yearLevel: z.enum(YEAR_LEVEL_VALUES as [ScholarshipYearLevel, ...ScholarshipYearLevel[]]),
    expectedGraduationYear: z.coerce.number().int().min(2026).max(2035),

    consentGiven: z.literal(true, { errorMap: () => ({ message: 'You must give your consent to submit.' }) }),
}).superRefine((data, ctx) => {
    if (data.school === OTHER_SCHOOL_VALUE && !data.schoolOther) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['schoolOther'], message: 'Please specify your school.' });
    }
    if (data.course === OTHER_COURSE_VALUE && !data.courseOther) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['courseOther'], message: 'Please specify your course.' });
    }
});

export type SubmitScholarshipApplicationInput = z.infer<typeof scholarshipApplicationSchema>;

function generateScholarshipReferenceNo(): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const rand = randomBytes(3).toString('hex').toUpperCase();
    return `RTD-${yyyy}${mm}${dd}-${rand}`;
}

/**
 * PUBLIC — accepts a scholarship application from the unauthenticated
 * /scholarship/apply form. Does NOT call assertActor. Validates fully
 * server-side using zod, computes shortlisting, and writes the record
 * via the Admin SDK (firestore rules deny client writes to this
 * collection).
 */
export async function submitScholarshipApplication(input: unknown) {
    try {
        const parsed = scholarshipApplicationSchema.safeParse(input);
        if (!parsed.success) {
            const firstIssue = parsed.error.issues[0];
            return {
                success: false as const,
                error: firstIssue?.message ?? 'Invalid submission.',
                fieldErrors: parsed.error.flatten().fieldErrors,
            };
        }
        const data = parsed.data;

        const shortlist = evaluateShortlist({
            school: data.school,
            schoolOther: data.schoolOther,
            course: data.course,
            courseOther: data.courseOther,
        });

        const referenceNo = generateScholarshipReferenceNo();
        const docRef = adminDb.collection('scholarshipApplications').doc();

        // Resolve display values: if "Other", use the typed-in value for storage/export.
        const schoolDisplay = data.school === OTHER_SCHOOL_VALUE
            ? (data.schoolOther || 'Other')
            : data.school;
        const courseDisplay = data.course === OTHER_COURSE_VALUE
            ? (data.courseOther || 'Other')
            : data.course;

        const record = {
            referenceNo,
            lastName: data.lastName,
            firstName: data.firstName,
            middleName: data.middleName ?? '',
            suffix: data.suffix ?? '',
            dateOfBirth: data.dateOfBirth,
            sex: data.sex,
            civilStatus: data.civilStatus,

            homeAddress: data.homeAddress,
            city: data.city,
            province: data.province,
            postalCode: data.postalCode ?? '',
            mobile: data.mobile,
            email: data.email,

            parentName: data.parentName,
            parentRelationship: data.parentRelationship,
            parentContact: data.parentContact,
            incomeBracket: data.incomeBracket,

            school: schoolDisplay,
            schoolOther: data.school === OTHER_SCHOOL_VALUE ? (data.schoolOther ?? '') : '',
            course: courseDisplay,
            courseOther: data.course === OTHER_COURSE_VALUE ? (data.courseOther ?? '') : '',
            yearLevel: data.yearLevel,
            expectedGraduationYear: data.expectedGraduationYear,

            consentGiven: true,

            isShortlisted: shortlist.isShortlisted,
            shortlistReason: shortlist.reason,

            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        await docRef.set(record);

        // Audit the submission with a system actor — the applicant is unauthenticated.
        await logAudit({
            actorUid: 'public',
            actorEmail: data.email,
            action: 'create',
            entityType: 'scholarshipApplication',
            entityId: docRef.id,
            details: {
                referenceNo,
                isShortlisted: shortlist.isShortlisted,
                shortlistReason: shortlist.reason,
                school: schoolDisplay,
                course: courseDisplay,
            },
        });

        return { success: true as const, id: docRef.id, referenceNo };
    } catch (error: any) {
        console.error('submitScholarshipApplication error:', error);
        return { success: false as const, error: error?.message ?? 'Failed to submit application.' };
    }
}

function assertCanViewScholarship(actor: VerifiedActor) {
    if (actor.isPlatformAdmin) return;
    if (!actor.profile) throw new Error('Permission denied.');
    if (!canViewPage(actor.profile, 'scholarship_applications')) {
        throw new Error('Permission denied. You do not have access to scholarship applications.');
    }
}

export type ScholarshipApplicationListItem = Omit<ScholarshipApplication, 'createdAt' | 'updatedAt'> & {
    createdAt: string | null;
    updatedAt: string | null;
};

function serializeTimestamp(value: any): string | null {
    if (!value) return null;
    if (typeof value?.toDate === 'function') {
        return value.toDate().toISOString();
    }
    if (value instanceof Date) return value.toISOString();
    return null;
}

/**
 * ADMIN — lists every scholarship application for users with
 * scholarship_applications page access. Audited.
 */
export async function getScholarshipApplications(actorToken: ActorToken): Promise<
    | { success: true; data: ScholarshipApplicationListItem[] }
    | { success: false; error: string }
> {
    try {
        const actor = await resolveActor(actorToken);
        assertCanViewScholarship(actor);

        const snap = await adminDb
            .collection('scholarshipApplications')
            .orderBy('createdAt', 'desc')
            .get();

        const items: ScholarshipApplicationListItem[] = snap.docs.map((d) => {
            const raw = d.data() as any;
            return {
                id: d.id,
                referenceNo: raw.referenceNo,
                lastName: raw.lastName,
                firstName: raw.firstName,
                middleName: raw.middleName ?? '',
                suffix: raw.suffix ?? '',
                dateOfBirth: raw.dateOfBirth,
                sex: raw.sex,
                civilStatus: raw.civilStatus,
                homeAddress: raw.homeAddress,
                city: raw.city,
                province: raw.province,
                postalCode: raw.postalCode ?? '',
                mobile: raw.mobile,
                email: raw.email,
                parentName: raw.parentName,
                parentRelationship: raw.parentRelationship,
                parentContact: raw.parentContact,
                incomeBracket: raw.incomeBracket,
                school: raw.school,
                schoolOther: raw.schoolOther ?? '',
                course: raw.course,
                courseOther: raw.courseOther ?? '',
                yearLevel: raw.yearLevel,
                expectedGraduationYear: raw.expectedGraduationYear,
                consentGiven: raw.consentGiven === true,
                isShortlisted: raw.isShortlisted === true,
                shortlistReason: raw.shortlistReason ?? '',
                createdAt: serializeTimestamp(raw.createdAt),
                updatedAt: serializeTimestamp(raw.updatedAt),
            };
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'view',
            entityType: 'scholarshipApplication',
            entityId: 'list',
            details: { count: items.length },
        });

        return { success: true, data: items };
    } catch (error: any) {
        console.error('getScholarshipApplications error:', error);
        return { success: false, error: error?.message ?? 'Failed to load applications.' };
    }
}

function csvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

/**
 * ADMIN — exports applications as CSV. Accepts an optional filter so the
 * client can ship "All / Shortlisted / Not Shortlisted" without a second
 * round-trip. Audited.
 */
export async function exportScholarshipApplicationsCSV(
    actorToken: ActorToken,
    filter: 'all' | 'shortlisted' | 'not_shortlisted' = 'all',
): Promise<{ success: true; csv: string; filename: string } | { success: false; error: string }> {
    try {
        const actor = await resolveActor(actorToken);
        assertCanViewScholarship(actor);
        if (!actor.isPlatformAdmin && actor.profile && !canDo(actor.profile, 'scholarship_applications', 'read')) {
            return { success: false, error: 'Permission denied.' };
        }

        const snap = await adminDb
            .collection('scholarshipApplications')
            .orderBy('createdAt', 'desc')
            .get();

        const rows = snap.docs
            .map((d) => d.data() as any)
            .filter((r) => {
                if (filter === 'shortlisted') return r.isShortlisted === true;
                if (filter === 'not_shortlisted') return r.isShortlisted !== true;
                return true;
            });

        const header = [
            'Date Submitted', 'Reference No.', 'Last Name', 'First Name', 'Middle Name', 'Suffix',
            'Date of Birth', 'Sex', 'Civil Status',
            'Home Address', 'City/Municipality', 'Province', 'Postal Code', 'Mobile', 'Email',
            'Parent/Guardian', 'Relationship', 'Parent Contact', 'Income Bracket',
            'School', 'Course', 'Year Level', 'Expected Graduation Year',
            'Shortlisted', 'Shortlist Reason',
        ];

        const lines: string[] = [header.map(csvCell).join(',')];
        for (const r of rows) {
            const submittedIso = serializeTimestamp(r.createdAt) ?? '';
            lines.push([
                submittedIso, r.referenceNo, r.lastName, r.firstName, r.middleName ?? '', r.suffix ?? '',
                r.dateOfBirth, r.sex, r.civilStatus,
                r.homeAddress, r.city, r.province, r.postalCode ?? '', r.mobile, r.email,
                r.parentName, r.parentRelationship, r.parentContact, r.incomeBracket,
                r.school, r.course, r.yearLevel, r.expectedGraduationYear,
                r.isShortlisted ? 'YES' : 'NO', r.shortlistReason ?? '',
            ].map(csvCell).join(','));
        }

        const csv = lines.join('\r\n');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `recto-tulong-dunong-${filter}-${stamp}.csv`;

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'export',
            entityType: 'scholarshipApplication',
            entityId: 'list',
            details: { filter, count: rows.length },
        });

        return { success: true, csv, filename };
    } catch (error: any) {
        console.error('exportScholarshipApplicationsCSV error:', error);
        return { success: false, error: error?.message ?? 'Failed to export CSV.' };
    }
}

/**
 * ADMIN — logs a "view detail" audit event. Called from the client when
 * a user opens a submission's detail dialog. The underlying record is
 * already on the client thanks to getScholarshipApplications, so we
 * only need to record that the human looked at it.
 */
export async function logScholarshipApplicationView(applicationId: string, actorToken: ActorToken) {
    try {
        const actor = await resolveActor(actorToken);
        assertCanViewScholarship(actor);
        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'view',
            entityType: 'scholarshipApplication',
            entityId: applicationId,
        });
        return { success: true as const };
    } catch (error: any) {
        return { success: false as const, error: error?.message ?? 'Failed to log view.' };
    }
}
