'use server';

import {
  generateBarangayProfiles as generateBarangayProfilesFlow,
  type GenerateBarangayProfilesInput,
} from '@/ai/flows/generate-barangay-profiles';
import { db } from '@/lib/firebase';
import { ProjectRecord, Barangay, CaptainProfile, UserProfile, Department, Position } from '@/lib/types';
import { logAudit } from '@/lib/audit';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';

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

        data.forEach(brgyData => {
            const docRef = doc(brgyCollection);
            batch.set(docRef, {
                ...brgyData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        });

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
        const newDeptRef = await addDoc(collection(db, 'departments'), {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'department',
            entityId: newDeptRef.id,
            details: data,
        });
        
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateDepartment(id: string, data: Partial<Omit<Department, 'id'>>, actor: Actor) {
    try {
        const deptDoc = doc(db, 'departments', id);
        await updateDoc(deptDoc, {
            ...data,
            updatedAt: serverTimestamp(),
        });

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
        const deptDoc = doc(db, 'departments', id);
        await deleteDoc(deptDoc);

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


type AddPositionData = Omit<Position, 'id' | 'createdAt' | 'updatedAt'>;

export async function addPosition(data: AddPositionData, actor: Actor) {
    try {
        const newPosRef = await addDoc(collection(db, 'positions'), {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'create',
            entityType: 'position',
            entityId: newPosRef.id,
            details: data,
        });
        
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updatePosition(id: string, data: Partial<Omit<Position, 'id'>>, actor: Actor) {
    try {
        const posDoc = doc(db, 'positions', id);
        await updateDoc(posDoc, {
            ...data,
            updatedAt: serverTimestamp(),
        });

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'update',
            entityType: 'position',
            entityId: id,
            details: data,
        });
        
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deletePosition(id: string, actor: Actor) {
    try {
        const posDoc = doc(db, 'positions', id);
        await deleteDoc(posDoc);

        await logAudit({
            actorUid: actor.uid,
            actorEmail: actor.email,
            action: 'delete',
            entityType: 'position',
            entityId: id,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
