import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const routesData = {
  "A": { name: "KURMANNAPALEM", time: "6:45am", stops: ["Kurmannapalem", "Vadlapudi", "Srinagar", "Gajuwaka Police Station", "R.K.Hospital", "Panthulu Gari Meda", "BHPV", "Sheelanagar", "Airport", "Gopalapatnam Police Station", "Simhachalam Depot", "Srinivasa Nagar", "Goshala", "Simhachalam Complex", "Adivivaram", "Gudilova", "Anandapuram"] },
  "B": { name: "Scindia", time: "6:45am", stops: ["Scindia", "Sriharipuram", "Coramandal Gate", "Gajuwaka Depot", "Zinc Gate", "BC.Road", "Old Gajuwaka", "Panthulu Gari Meda", "Natayyapalem", "Airport", "Gopalapatnam Bunk", "L.G.Polymers", "Vepagunta", "Sontyam", "water Tank", "Dukkavanipalem"] },
  "C": { name: "SRIKAKULAM", time: "6:45am", stops: ["Arasavilli", "Mill Junction", "OBS", "Day & Night", "PN.Colony", "Kintara Mill", "Chilakapalem", "Subadhrapuram", "Ranastalam", "Pydibhimavaram", "Kandivalasa Gedda", "Mylan Company", "Poosapati Rega", "Natavalasa", "Kandivalasa Gedda", "Poosapati Rega", "Natavalasa"] },
  "D": { name: "SRIKAKULAM", time: "6:45am", stops: ["Day & Night", "Madhava Motors", "Rama Lakshmana Junction", "Mill Junction", "OBS", "Day & Night", "PN Colony", "Nava Bharat Junction", "Chilakapalem", "Subhadrapuram", "Ranasthalam", "Kosta", "Chinapisini", "Pydibhimavaram", "Poosapati Rega", "Natavalasa"] },
  "E": { name: "BOBBILI", time: "6:45am", stops: ["Bobbili", "Mettavalasa", "Rambadrapuram", "Busayavalasa", "Manapuram", "Gajapathinagaram", "Bondapalli Police Station", "Ambativalasa", "Gotlam", "JNTU College", "K.L.Puram"] },
  "F": { name: "SALURU", time: "6:45am", stops: ["Saluru Bosi Bommba Center", "Rambhadrapuram By Pass", "Maradam", "Komatapalli", "Manapuram", "Gudivada", "Gajapathinagaram", "Bondapalli Police Station", "Bondapalli", "Ambativalasa", "Gotlam", "RTO Office", "K.L.Puram", "Bridge Down"] },
  "G": { name: "NAD - KARASA", time: "7:00am", stops: ["NAD", "Karasa", "Marripalem", "104 Area", "IT Junction", "Urvasi", "Gnanapuram", "Allipuram", "Railway New Colony", "Dondaparthy", "Sangam Office", "Akkayyapalem Down", "4 th Police Station"] },
  "H": { name: "SIRIPURAM -VSP", time: "7:00am", stops: ["Gadi Raju Palace", "Baba Bazar", "Ramalakshmi Appartment", "Ushodaya", "AS Raja Circle / MVP", "Appu Ghar / MVP", "Visakha Valley School Down", "PM Plaem", "PM Palem Last Bus Stop,3rd,2nd,1st", "Carshed", "Madhurawada", "Kommadhi", "PM Plaem Stadium", "Carshed"] },
  "I": { name: "NAD - NSTL GATE", time: "7:00am", stops: ["NAD", "R & B", "Punjab Hotel", "Birla", "5th Town", "Kancharapalem", "Port Stadium", "Akkayyapalem Hi-Way", "4 th Town Police Station", "Shilparamam", "Marikavalasa", "Tagarapuvalasa", "Rajapulova"] },
  "J": { name: "NAD - NSTL", time: "7:00am", stops: ["NSTL Gate", "R & B", "Punjab Hotel", "Birla", "Urvasi", "Kancharapalem", "Tatichetlapalem", "Port Hospital", "Akkayyapalem Hi-Way", "4 th Town PS", "Maddilapalem", "Automotive", "Venkojipalem", "Hanumanthawaka", "Dairy Form", "Yendada Bus Stop", "Carshed", "Chandrampalem", "Madhurawada", "Kommadi"] },
  "K": { name: "TOWN KOTHA ROAD", time: "7:00am", stops: ["Town Kotha Road", "Purna Market", "Chitralaya", "Jagadamba", "Green Park", "Seven Hills", "Ramnagar", "Governor Bangalow", "All India Radio", "Siripuram", "AU Out gate", "China waltair", "Lawsons Bay Colony Bunk", "Mvp TTD", "Girijan Bhavan"] },
  "L": { name: "NAD - NSTL", time: "7:00am", stops: ["NAD", "5 th Town PS", "Urvasi", "Tatichetlapalem", "Port Hospital", "Gurudwara", "Satyam Jn", "Kinnara Theator", "Maddilapalem", "Isukathota", "Yendada Bunk", "Yendada Bus Stop", "Tagarapuvalasa 3 temples", "Gosthani River", "Venkojipalem", "Hanumanthawaka(Vims)", "Kamat Hotel", "Peddi Palem", "Rajula Tallavalasa"] },
  "M": { name: "PENDURTHY", time: "7:00am", stops: ["Chinamushidiwada", "Government Hospital", "Pendhurty Jn", "Saripalli", "Desapatripalem", "Mangalapalem", "Kothavalasa Railway Station", "Kothavalasa", "Kothavalasa High School", "Kantikapallli", "Katikapalli", "Alamanda"] },
  "N": { name: "NAD - Baji Jn..", time: "7:00am", stops: ["Krishna Nagar", "Naidu Thota", "Vepagunta Anjaneya Swamy Temple", "Krishnarayapuram", "Purushottapuram", "Sujathanagar", "Chinnamushidivada", "Pendhurty Police Station", "Hospital", "Pendurthy", "Pendurthy Kata", "Akkireddy Palem", "Gandigundam"] },
  "O": { name: "NAD - Baji Jn..", time: "7:00am", stops: ["Baji Jn", "Gopalapatnam Rly St", "Gopalapatnam Bunk", "Srinivasanagar", "Adivivaram", "Arilova", "Saibaba Temple", "Pedagadili", "Vims Hospital", "Dairy Form", "Visakha Valley", "Bheemili Cross Road"] },
  "P": { name: "DABAGARDENS", time: "7:00am", stops: ["Town Kotha Road", "Purnamarket", "Jagadamba", "Jail Road", "R.K.Family Store", "Seethampeta", "Satyam Jn", "Eenadu", "Seethammadara", "MMTC", "HB.Colony"] },
  "Q": { name: "DENKADA", time: "7:45am", stops: ["Denkada", "Gunupur", "Chinna Tadivada", "Pedda Tadivada", "Pedda Tadivada Bank", "Narayanapuram", "Check Post", "Jammu", "Jammunarayanapuram", "Maramma Thalli Gudi", "Dasannapeta Ring Road", "Sun School", "Venkateswara Swamy Temple Arch"] },
  "R": { name: "Nellimarla", time: "7:45am", stops: ["Moida Jn", "Nellimarlla Complex", "Ramatheertalu", "Mims Hospital", "Pool Bhag", "Water Tank", "Dasannapeta", "Sun Scool", "Ice Factory Jn", "MR College", "NCS", "Railway Station", "Poovada School", "Ice Factory"] },
  "S": { name: "L KOTA", time: "7:00am", stops: ["L.Kota", "Sompuram", "Paturu", "Boddam", "Venkataramanapeta", "Dharmavaram", "Seetharampuram", "Korlam", "Bhonagi", "Vasadi", "Tamarapalli Jn", "Lakkidam", "Narava", "Ramavaram"] },
  "T": { name: "AYYANNAPETA", time: "7:45am", stops: ["Ayyannapeta", "Kamakshinagar", "Kanapaka", "Collector Office", "Vuda Colony", "R & B", "Bridge Down", "Pradeepnagar", "Court", "D-Mart", "Y-Junction", "Kamakshinagar", "Kanapaka", "Vizianagaram RTC Complex", "Bhasyam School"] },
  "U": { name: "CHEEPURUPALLI", time: "7:10am", stops: ["Cheepurupalli Complex", "Anjaneyapuram", "Garividi Eye hospital", "Garividi Theator", "Bridge Up & Down", "Atchuthapuram", "Gujjingavalasa", "Gudem Jn", "Gurla", "Nellimarlla Railway Station", "Moida Jn", "Nellimarlla Complex", "Rama Theerthalu Jn", "Diet/Mims Hospital", "Poolbhaga"] },
  "V": { name: "AYYANNAPETA", time: "7:45am", stops: ["Ayyannapeta", "Kamakshinagar", "Kanapaka", "Collector Office", "Vuda Colony", "R & B", "Bridge Down", "Pradeepnagar", "Court", "D-Mart", "Y-Junction"] },
  "W": { name: "POOLBHAG", time: "7:45am", stops: ["Poolbhag", "Water Tank", "Dasannapeta", "Ring Road", "MR College", "NCS", "CMR", "Railway Station", "Korukonda Saink School", "Chinnapuram"] },
  "X": { name: "S KOTA", time: "7:15am", stops: ["S.Kota Complex", "Devi Gudi Jn", "Krishnapuram Jn", "Pavada Jn", "Jagaram", "Jami", "Bheemasingi", "Sugar Factory"] }
};

async function seed() {
  console.log("Creating Admin User...");
  const adminEmail = "admin2@mvgr.edu.in";
  const adminPassword = "mvgrpassword";

  // 1. Create Auth User
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { role: 'private-admin', full_name: 'MVGR Admin' }
  });

  if (userError && !userError.message.includes("already been registered") && !userError.message.includes("User already registered")) {
    console.error("Error creating user:", userError);
    return;
  }

  // Get user ID
  let userId;
  if (userData?.user?.id) {
    userId = userData.user.id;
  } else {
    const { data: users } = await supabase.from("auth_accounts").select("user_id").eq("email", adminEmail).single();
    userId = users?.user_id;
  }

  if (!userId) {
    const { data: users } = await supabase.from("auth_accounts").select("user_id").eq("email", adminEmail).single();
    userId = users?.user_id;
    if (!userId) {
      console.log("Could not find/create user ID");
      return;
    }
  }
  
  // Update auth_accounts explicitly just in case trigger missed it
  await supabase.from("auth_accounts").upsert({
    user_id: userId,
    email: adminEmail,
    role: "private-admin",
    display_name: "MVGR Admin",
    has_password: true,
    provider: "email"
  }, { onConflict: "user_id" });

  console.log("User ID:", userId);

  // 2. Create Institution
  const institutionCode = "MVGR-001";
  const accessCode = "MVGRPASS";
  
  const { data: instData, error: instError } = await supabase.from("institutions").upsert({
    owner_user_id: userId,
    name: "MVGR College of Engineering",
    institution_name: "MVGR College of Engineering",
    institution_type: "College",
    contact_person: "MVGR Admin",
    email: adminEmail,
    phone_number: "9999999999",
    institution_code: institutionCode,
    access_code: accessCode,
  }, { onConflict: "owner_user_id" }).select("id").single();

  if (instError) {
    console.error("Error creating institution:", instError);
    return;
  }
  
  const institutionId = instData.id;
  console.log("Institution created with ID:", institutionId);

  // Add to institution_users
  await supabase.from("institution_users").upsert({
    user_id: userId,
    institution_id: institutionId,
    role: "private_institution_admin"
  }, { onConflict: "user_id, institution_id" });


  // 3. Insert Routes
  console.log("Inserting Routes...");
  for (const [code, details] of Object.entries(routesData)) {
    // Generate a unique driver access code
    const driverAccessCode = `MVGR-${code}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Format stops as expected by the DB: JSON array of objects
    // Since we don't have lat/lng, we'll give them a default of 17.6868, 83.2185 (Vizag center) and let the admin move them
    let latOffset = 0;
    const formattedStops = details.stops.map((stopName, idx) => {
      latOffset += 0.001; // Just offset slightly so they don't perfectly stack
      return {
        name: stopName,
        lat: 17.6868 + latOffset,
        lng: 83.2185 + latOffset
      };
    });

    const routePayload = {
      institution_id: institutionId,
      driver_access_code: driverAccessCode,
      bus_number: code,
      route_name: `${details.name} (${details.time})`,
      stops: formattedStops,
      public_mode: false
    };

    const { error: routeError } = await supabase.from("routes").insert(routePayload);
    if (routeError) {
      console.error(`Error inserting route ${code}:`, routeError);
    } else {
      console.log(`Inserted Route ${code}`);
    }
  }

  console.log("Done! MVGR Setup Complete.");
  console.log("-----------------------------------------");
  console.log("Admin Email: admin@mvgr.edu.in");
  console.log("Admin Password: mvgrpassword");
  console.log("Institution Code: MVGR-001");
  console.log("Private User Access Code: MVGRPASS");
  console.log("-----------------------------------------");
}

seed().catch(console.error);
