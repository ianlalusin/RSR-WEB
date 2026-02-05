'use server';

import {
  generateBarangayProfiles as generateBarangayProfilesFlow,
  type GenerateBarangayProfilesInput,
} from '@/ai/flows/generate-barangay-profiles';
import { db } from '@/lib/firebase';
import { ProjectRecord, Barangay, CaptainProfile, UserProfile, Department, Role } from '@/lib/types';
import { logAudit } from '@/lib/audit';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc, writeBatch, deleteField, setDoc } from 'firebase/firestore';

export async function generateBarangayProfiles(input: GenerateBarangayProfilesInput, actor: Actor) {
  try {
    const result = await generateBarangayProfilesFlow(input);

    await logAudit({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: 'generate_ai_profile',
      entityType: 'barangay',
      entityId: input.barangayName, // Assuming name is unique enough for logging
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

// Actor type for audit logging
type Actor = { uid: string; email: string | null };

type AddBarangayData = Omit<Barangay, 'id' | 'createdAt' | 'updatedAt'>;

export async function addBarangay(data: AddBarangayData, actor: Actor) {
    try {
        const batch = writeBatch(db);
        const brgyCollection = collection(db, 'barangays');
        const newBrgyRef = doc(brgyCollection);
        
        batch.set(newBrgyRef, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        const listItemData = {
            name: data.name,
            districtId: data.districtId,
            districtName: data.districtName,
            population: data.population,
            votingPopulation: data.votingPopulation,
            rsrVotes: data.rsrVotes,
            favoredVotePct: data.favoredVotePct,
            isWin: data.isWin,
        };
        
        const listDocRef = doc(db, 'lists', 'barangays');
        batch.set(listDocRef, {
            barangays: {
                [newBrgyRef.id]: listItemData
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
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateBarangay(id: string, data: Partial<Omit<Barangay, 'id'>>, actor: Actor) {
    try {
        const batch = writeBatch(db);
        const brgyDoc = doc(db, 'barangays', id);
        
        batch.update(brgyDoc, {
            ...data,
            updatedAt: serverTimestamp(),
        });

        const listUpdateData: Record<string, any> = {};
        if (data.name !== undefined) listUpdateData[`barangays.${id}.name`] = data.name;
        if (data.districtId !== undefined) listUpdateData[`barangays.${id}.districtId`] = data.districtId;
        if (data.districtName !== undefined) listUpdateData[`barangays.${id}.districtName`] = data.districtName;
        if (data.population !== undefined) listUpdateData[`barangays.${id}.population`] = data.population;
        if (data.votingPopulation !== undefined) listUpdateData[`barangays.${id}.votingPopulation`] = data.votingPopulation;
        if (data.rsrVotes !== undefined) listUpdateData[`barangays.${id}.rsrVotes`] = data.rsrVotes;
        if (data.favoredVotePct !== undefined) listUpdateData[`barangays.${id}.favoredVotePct`] = data.favoredVotePct;
        if (data.isWin !== undefined) listUpdateData[`barangays.${id}.isWin`] = data.isWin;

        if (Object.keys(listUpdateData).length > 0) {
            const listDocRef = doc(db, 'lists', 'barangays');
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

export async function deleteBarangay(id: string, actor: Actor) {
    try {
        const batch = writeBatch(db);
        const brgyDoc = doc(db, 'barangays', id);
        batch.delete(brgyDoc);

        const listDocRef = doc(db, 'lists', 'barangays');
        batch.update(listDocRef, {
            [`barangays.${id}`]: deleteField()
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

export async function bulkAddBarangays(data: Omit<Barangay, 'id' | 'createdAt' | 'updatedAt'>[], actor: Actor) {
    try {
        const brgyCollection = collection(db, 'barangays');
        const batch = writeBatch(db);

        const listUpdates: Record<string, any> = {};

        data.forEach(brgyData => {
            const docRef = doc(brgyCollection);
            batch.set(docRef, {
                ...brgyData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            const listItemData = {
                name: brgyData.name,
                districtId: brgyData.districtId,
                districtName: brgyData.districtName,
                population: brgyData.population,
                votingPopulation: brgyData.votingPopulation,
                rsrVotes: brgyData.rsrVotes,
                favoredVotePct: brgyData.favoredVotePct,
                isWin: brgyData.isWin,
            };
            listUpdates[docRef.id] = listItemData;
        });

        const listDocRef = doc(db, 'lists', 'barangays');
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


export async function updateUserAccess(uid: string, data: Partial<UserProfile>, actor: Actor, originalData: Partial<UserProfile>) {
    try {
        const userDoc = doc(db, 'users', uid);
        await updateDoc(userDoc, { ...data, updatedAt: serverTimestamp() });
        
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

export async function updateSelfProfile(uid: string, data: { displayName: string, photoURL: string }, actor: Actor) {
    if (actor.uid !== uid) {
        return { success: false, error: 'Permission denied. You can only update your own profile.' };
    }
    
    try {
        const userDoc = doc(db, 'users', uid);
        await updateDoc(userDoc, {
            displayName: data.displayName,
            photoURL: data.photoURL,
            updatedAt: serverTimestamp(),
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

export async function updateCaptainProfile(brgyId: string, isCreating: boolean, data: Partial<Omit<CaptainProfile, 'createdAt'>>, actor: Actor) {
    try {
        const batch = writeBatch(db);
        const profileDoc = doc(db, `barangays/${brgyId}/captainProfile/main`);

        const updateData = {
            ...data,
            updatedAt: serverTimestamp(),
            updatedByUid: actor.uid,
            updatedByEmail: actor.email,
        };

        if (isCreating) {
            batch.set(profileDoc, {
                ...updateData,
                createdAt: serverTimestamp(),
                createdByUid: actor.uid,
                createdByEmail: actor.email,
            });
        } else {
            batch.update(profileDoc, updateData);
        }
        
        await batch.commit();

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: isCreating ? 'create' : 'update',
            entityType: 'captainProfile',
            entityId: profileDoc.id,
            details: data,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

type AddProjectData = Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid'>;

export async function addProjectRecord(data: AddProjectData, actor: Actor) {
    try {
        const newRecordRef = await addDoc(collection(db, 'projectRecords'), {
             ...data,
            createdByUid: actor.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
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

export async function updateProjectRecord(id: string, data: Partial<Omit<ProjectRecord, 'id'>>, actor: Actor) {
    try {
        const recordDoc = doc(db, 'projectRecords', id);
        await updateDoc(recordDoc, {
            ...data,
            updatedAt: serverTimestamp(),
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

export async function deleteProjectRecord(id: string, actor: Actor) {
    try {
        const recordDoc = doc(db, 'projectRecords', id);
        await deleteDoc(recordDoc);

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

export async function addDepartment(data: AddDepartmentData, actor: Actor) {
    try {
        const newDeptId = doc(collection(db, 'dummy')).id; // Temp ref to get an ID
        const listDocRef = doc(db, 'lists', 'departments');

        const newItemData = {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        await setDoc(listDocRef, {
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

export async function updateDepartment(id: string, data: Partial<Omit<Department, 'id' | 'createdAt' | 'updatedAt'>>, actor: Actor) {
    try {
        const listDocRef = doc(db, 'lists', 'departments');
        
        const updatePayload: Record<string, any> = {
            [`departments.${id}.updatedAt`]: serverTimestamp()
        };
        if (data.name !== undefined) updatePayload[`departments.${id}.name`] = data.name;
        if (data.description !== undefined) updatePayload[`departments.${id}.description`] = data.description;
        if (data.pageVisibility !== undefined) updatePayload[`departments.${id}.pageVisibility`] = data.pageVisibility;

        await updateDoc(listDocRef, updatePayload);

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

export async function deleteDepartment(id: string, actor: Actor) {
    try {
        const listDocRef = doc(db, 'lists', 'departments');
        await updateDoc(listDocRef, { [`departments.${id}`]: deleteField() });

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


type AddRoleData = Omit<Role, 'id' | 'createdAt' | 'updatedAt'>;

export async function addRole(data: AddRoleData, actor: Actor) {
    try {
        const newRoleId = doc(collection(db, 'dummy')).id; // Temp ref to get an ID
        const listDocRef = doc(db, 'lists', 'roles');
        
        const newItemData = {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        await setDoc(listDocRef, { roles: { [newRoleId]: newItemData } }, { merge: true });

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

export async function updateRole(id: string, data: Partial<Omit<Role, 'id' | 'createdAt' | 'updatedAt'>>, actor: Actor) {
    try {
        const listDocRef = doc(db, 'lists', 'roles');
        
        const updatePayload: Record<string, any> = {
            [`roles.${id}.updatedAt`]: serverTimestamp()
        };
        if (data.name !== undefined) updatePayload[`roles.${id}.name`] = data.name;

        await updateDoc(listDocRef, updatePayload);

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

export async function deleteRole(id: string, actor: Actor) {
    try {
        const listDocRef = doc(db, 'lists', 'roles');
        await updateDoc(listDocRef, { [`roles.${id}`]: deleteField() });

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
