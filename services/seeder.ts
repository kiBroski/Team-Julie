import { db } from '../firebase';
import { InstallationRecord, UserProfile, JobStatus, FiberReady } from '../types';

const TEAMS = ['Nairobi North', 'Nairobi West', 'Kiambu East'];
const STATUSES: JobStatus[] = ['Pending', 'Installed', 'Rejected', 'Lead', 'Forwarded'];

const random = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
const randomPhone = () => `07${Math.floor(Math.random() * 90000000 + 10000000)}`;
// Nairobi Area Coords
const randomCoords = () => `-1.${Math.floor(Math.random() * 20000) + 20000}, 36.${Math.floor(Math.random() * 20000) + 70000}`;

export const seedDatabase = async () => {
  // Firestore batches are limited to 500 ops.
  // We have 12 users + 180 records = 192 ops. Safe for one batch.
  const batch = db.batch();
  
  console.log("Starting Seed...");

  // 1. Create Supervisors (3)
  const supervisors: UserProfile[] = [];
  for (let i = 1; i <= 3; i++) {
    const uid = `seed_sup_${i}`;
    const sup: UserProfile = {
      uid,
      displayName: `Supervisor ${i}`,
      phoneNumber: randomPhone(),
      team: TEAMS[i-1],
      email: `supervisor${i}@fiber.test`,
      role: 'supervisor'
    };
    supervisors.push(sup);
    const ref = db.collection('users').doc(uid);
    batch.set(ref, sup);
  }

  // 2. Create DSRs (3 per team -> 9 total)
  const dsrs: UserProfile[] = [];
  TEAMS.forEach((team, tIdx) => {
    for (let i = 1; i <= 3; i++) {
        const uid = `seed_dsr_${tIdx}_${i}`;
        const dsr: UserProfile = {
            uid,
            displayName: `DSR ${team.split(' ')[1]} ${i}`,
            phoneNumber: randomPhone(),
            team: team,
            email: `dsr${tIdx}_${i}@fiber.test`,
            role: 'dsr'
        };
        dsrs.push(dsr);
        const ref = db.collection('users').doc(uid);
        batch.set(ref, dsr);
    }
  });

  // 3. Create Installations (20 per DSR -> 180 total)
  dsrs.forEach(dsr => {
      for(let k=0; k<20; k++) {
          const status = random(STATUSES);
          const recordRef = db.collection('installations').doc();
          
          // Random date within last 30 days
          const daysAgo = Math.floor(Math.random() * 30);
          const date = new Date();
          date.setDate(date.getDate() - daysAgo);

          const record: InstallationRecord = {
              id: recordRef.id,
              createdByUid: dsr.uid, // Linking to the fake DSR
              createdAt: date.toISOString(),
              updatedAt: date.toISOString(),
              synced: true,
              edited: false,
              source: 'manual',
              
              // Random Data
              Title: random(['Mr', 'Mrs', 'Dr', '']),
              Name: `Client ${dsr.displayName.split(' ')[1]} ${k+1}`,
              Contact: randomPhone(),
              AltContact: '',
              Email: `client${k}@test.com`,
              IdNo: Math.floor(Math.random() * 10000000).toString(),
              RoadName: random(['Mombasa Rd', 'Waiyaki Way', 'Thika Rd', 'Ngong Rd', 'Argwings Kodhek', 'Langata Rd']),
              Address: `Apt ${Math.floor(Math.random()*100)}`,
              FloorNo: `${Math.floor(Math.random()*10)}`,
              House: `${Math.floor(Math.random()*50)}`,
              FAT: `FAT-${Math.floor(Math.random()*99)}`,
              coordinates: randomCoords(),
              fiberReady: random(['Yes', 'No']) as FiberReady,
              JobStatus: status,
              AccountNumber: status === 'Installed' ? `ACC${Math.floor(Math.random()*10000)}` : '',
              DSR: dsr.displayName,
              DSRContacts: dsr.phoneNumber,
              Team: dsr.team,
              Comment: 'Auto-generated sample data for testing.'
          };
          batch.set(recordRef, record);
      }
  });

  await batch.commit();
  return "Successfully created 3 Teams, 3 Supervisors, 9 DSRs, and 180 Client Records.";
};
