'use server';

import {
  generateBarangayProfiles as generateBarangayProfilesFlow,
  type GenerateBarangayProfilesInput,
} from '@/ai/flows/generate-barangay-profiles';
import { db } from '@/lib/firebase';
import { ProjectRecord, Barangay, CaptainProfile, UserProfile, Department, Position } from '@/lib/types';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';

export async function generateBarangayProfiles(input: GenerateBarangayProfilesInput) {
  try {
    const result = await generateBarangayProfilesFlow(input);
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

        // Audit Log
        const auditLogRef = doc(collection(db, 'auditLogs'));
        batch.set(auditLogRef, {
            entityType: 'barangay',
            entityId: newBrgyRef.id,
            action: 'create',
            changes: data,
            actorUid: actor.uid,
            actorEmail: actor.email,
            createdAt: serverTimestamp(),
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

        // Audit Log
        const auditLogRef = doc(collection(db, 'auditLogs'));
        batch.set(auditLogRef, {
            entityType: 'barangay',
            entityId: id,
            action: 'update',
            changes: data,
            actorUid: actor.uid,
            actorEmail: actor.email,
            createdAt: serverTimestamp(),
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

        // Audit Log
        const auditLogRef = doc(collection(db, 'auditLogs'));
        batch.set(auditLogRef, {
            entityType: 'barangay',
            entityId: id,
            action: 'delete',
            changes: {},
            actorUid: actor.uid,
            actorEmail: actor.email,
            createdAt: serverTimestamp(),
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
        const auditLogCollection = collection(db, 'auditLogs');
        const batch = writeBatch(db);

        data.forEach(brgyData => {
            const docRef = doc(brgyCollection);
            batch.set(docRef, {
                ...brgyData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            // Audit Log for each creation
            const auditLogRef = doc(auditLogCollection);
            batch.set(auditLogRef, {
                entityType: 'barangay',
                entityId: docRef.id,
                action: 'create',
                changes: { count: data.length, note: 'Bulk upload' },
                actorUid: actor.uid,
                actorEmail: actor.email,
                createdAt: serverTimestamp(),
            });
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


export async function updateUser(uid: string, data: Partial<UserProfile>, actor: Actor) {
    try {
        const batch = writeBatch(db);
        const userDoc = doc(db, 'users', uid);
        batch.update(userDoc, { ...data, updatedAt: serverTimestamp() });

        const auditLogRef = doc(collection(db, 'auditLogs'));
        batch.set(auditLogRef, {
            entityType: 'user',
            entityId: uid,
            action: 'update',
            changes: data,
            actorUid: actor.uid,
            actorEmail: actor.email,
            createdAt: serverTimestamp(),
        });

        await batch.commit();
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

        const auditLogRef = doc(collection(db, 'auditLogs'));
        batch.set(auditLogRef, {
            entityType: 'captainProfile',
            entityId: brgyId,
            action: isCreating ? 'create' : 'update',
            changes: data,
            actorUid: actor.uid,
            actorEmail: actor.email,
            createdAt: serverTimestamp(),
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function syncDistricts(actor: Actor) {
    try {
        const batch = writeBatch(db);
        const brgyCollectionRef = collection(db, 'barangays');
        const brgySnapshot = await getDocs(brgyCollectionRef);

        const districtMap: { [key: string]: string } = {
            "North": "North District",
            "South": "South District",
            "East": "East District",
            "West": "West District",
            "Urban": "Urban District",
        };
        const districtKeys = Object.keys(districtMap);
        let updatedCount = 0;

        brgySnapshot.forEach(docSnap => {
            const brgy = docSnap.data() as Omit<Barangay, 'id'>;
            const currentDistrictName = brgy.districtName;
            
            const matchingKey = districtKeys.find(key => key.toLowerCase() === currentDistrictName.toLowerCase().trim());

            if (matchingKey) {
                const newDistrictName = districtMap[matchingKey];
                const newDistrictId = newDistrictName.toLowerCase().replace(/\s/g, '-');
                
                if(brgy.districtName !== newDistrictName || brgy.districtId !== newDistrictId) {
                    batch.update(docSnap.ref, { districtName: newDistrictName, districtId: newDistrictId });
                    updatedCount++;
                }
            }
        });

        if (updatedCount > 0) {
            const auditLogRef = doc(collection(db, 'auditLogs'));
            batch.set(auditLogRef, {
                entityType: 'system',
                entityId: 'barangays_collection',
                action: 'bulk_update',
                changes: { operation: 'syncDistricts', updatedCount },
                actorUid: actor.uid,
                actorEmail: actor.email,
                createdAt: serverTimestamp(),
            });
            await batch.commit();
        }

        return { success: true, updatedCount };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


type AddProjectData = Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid'>;

export async function addProjectRecord(data: AddProjectData, actor: Actor) {
    try {
        const batch = writeBatch(db);
        const newRecordRef = doc(collection(db, 'projectRecords'));
        
        batch.set(newRecordRef, {
            ...data,
            createdByUid: actor.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        const auditLogRef = doc(collection(db, 'auditLogs'));
        batch.set(auditLogRef, {
            entityType: 'projectRecord',
            entityId: newRecordRef.id,
            action: 'create',
            changes: data,
            actorUid: actor.uid,
            actorEmail: actor.email,
            createdAt: serverTimestamp(),
        });
        
        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateProjectRecord(id: string, data: Partial<Omit<ProjectRecord, 'id'>>, actor: Actor) {
    try {
        const batch = writeBatch(db);
        const recordDoc = doc(db, 'projectRecords', id);
        
        batch.update(recordDoc, {
            ...data,
            updatedAt: serverTimestamp(),
        });

        const auditLogRef = doc(collection(db, 'auditLogs'));
        batch.set(auditLogRef, {
            entityType: 'projectRecord',
            entityId: id,
            action: 'update',
            changes: data,
            actorUid: actor.uid,
            actorEmail: actor.email,
            createdAt: serverTimestamp(),
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteProjectRecord(id: string, actor: Actor) {
    try {
        const batch = writeBatch(db);
        const recordDoc = doc(db, 'projectRecords', id);
        batch.delete(recordDoc);

        const auditLogRef = doc(collection(db, 'auditLogs'));
        batch.set(auditLogRef, {
            entityType: 'projectRecord',
            entityId: id,
            action: 'delete',
            changes: {},
            actorUid: actor.uid,
            actorEmail: actor.email,
            createdAt: serverTimestamp(),
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

type AddDepartmentData = Omit<Department, 'id' | 'createdAt' | 'updatedAt'>;

export async function addDepartment(data: AddDepartmentData, actor: Actor) {
    try {
        const batch = writeBatch(db);
        const newDeptRef = doc(collection(db, 'departments'));
        
        batch.set(newDeptRef, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        const auditLogRef = doc(collection(db, 'auditLogs'));
        batch.set(auditLogRef, {
            entityType: 'department',
            entityId: newDeptRef.id,
            action: 'create',
            changes: data,
            actorUid: actor.uid,
            actorEmail: actor.email,
            createdAt: serverTimestamp(),
        });
        
        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateDepartment(id: string, data: Partial<Omit<Department, 'id'>>, actor: Actor) {
    try {
        const batch = writeBatch(db);
        const deptDoc = doc(db, 'departments', id);
        
        batch.update(deptDoc, {
            ...data,
            updatedAt: serverTimestamp(),
        });

        const auditLogRef = doc(collection(db, 'auditLogs'));
        batch.set(auditLogRef, {
            entityType: 'department',
            entityId: id,
            action: 'update',
            changes: data,
            actorUid: actor.uid,
            actorEmail: actor.email,
            createdAt: serverTimestamp(),
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteDepartment(id: string, actor: Actor) {
    try {
        const batch = writeBatch(db);
        const deptDoc = doc(db, 'departments', id);
        batch.delete(deptDoc);

        const auditLogRef = doc(collection(db, 'auditLogs'));
        batch.set(auditLogRef, {
            entityType: 'department',
            entityId: id,
            action: 'delete',
            changes: {},
            actorUid: actor.uid,
            actorEmail: actor.email,
            createdAt: serverTimestamp(),
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


type AddPositionData = Omit<Position, 'id' | 'createdAt' | 'updatedAt'>;

export async function addPosition(data: AddPositionData, actor: Actor) {
    try {
        const batch = writeBatch(db);
        const newPosRef = doc(collection(db, 'positions'));
        
        batch.set(newPosRef, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        const auditLogRef = doc(collection(db, 'auditLogs'));
        batch.set(auditLogRef, {
            entityType: 'position',
            entityId: newPosRef.id,
            action: 'create',
            changes: data,
            actorUid: actor.uid,
            actorEmail: actor.email,
            createdAt: serverTimestamp(),
        });
        
        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updatePosition(id: string, data: Partial<Omit<Position, 'id'>>, actor: Actor) {
    try {
        const batch = writeBatch(db);
        const posDoc = doc(db, 'positions', id);
        
        batch.update(posDoc, {
            ...data,
            updatedAt: serverTimestamp(),
        });

        const auditLogRef = doc(collection(db, 'auditLogs'));
        batch.set(auditLogRef, {
            entityType: 'position',
            entityId: id,
            action: 'update',
            changes: data,
            actorUid: actor.uid,
            actorEmail: actor.email,
            createdAt: serverTimestamp(),
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deletePosition(id: string, actor: Actor) {
    try {
        const batch = writeBatch(db);
        const posDoc = doc(db, 'positions', id);
        batch.delete(posDoc);

        const auditLogRef = doc(collection(db, 'auditLogs'));
        batch.set(auditLogRef, {
            entityType: 'position',
            entityId: id,
            action: 'delete',
            changes: {},
            actorUid: actor.uid,
            actorEmail: actor.email,
            createdAt: serverTimestamp(),
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
