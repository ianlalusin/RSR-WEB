'use server';

import {
  generateBarangayProfiles as generateBarangayProfilesFlow,
  type GenerateBarangayProfilesInput,
} from '@/ai/flows/generate-barangay-profiles';
import { db } from '@/lib/firebase';
import { Barangay } from '@/lib/types';
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

type AddBarangayData = Omit<Barangay, 'id' | 'createdAt' | 'updatedAt'>;

export async function addBarangay(data: AddBarangayData) {
    try {
        const brgyCollection = collection(db, 'barangays');
        await addDoc(brgyCollection, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateBarangay(id: string, data: Partial<Omit<Barangay, 'id'>>) {
    try {
        const brgyDoc = doc(db, 'barangays', id);
        await updateDoc(brgyDoc, {
            ...data,
            updatedAt: serverTimestamp(),
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteBarangay(id: string) {
    try {
        const brgyDoc = doc(db, 'barangays', id);
        await deleteDoc(brgyDoc);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function bulkAddBarangays(data: Omit<Barangay, 'id' | 'createdAt' | 'updatedAt'>[]) {
    try {
        const brgyCollection = collection(db, 'barangays');
        const batch = writeBatch(db);

        data.forEach(brgyData => {
            const docRef = doc(brgyCollection); // Firestore will generate the ID
            batch.set(docRef, {
                ...brgyData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteAllBarangays() {
    try {
        const brgyCollection = collection(db, 'barangays');
        const snapshot = await getDocs(brgyCollection);
        
        if (snapshot.empty) {
            return { success: true };
        }

        const batchSize = 500;
        for (let i = 0; i < snapshot.docs.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = snapshot.docs.slice(i, i + batchSize);
            chunk.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
