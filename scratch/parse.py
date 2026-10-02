import json
import os

page1_text = """900R RTC Complex Rushikonda INS Kalinga,Sagar Nagar,MVP Colony Metro Express Madhurawada
400 RTC Complex Kurmannapalem Railway Stn,Scindia,Malkapuram,Gajuwaka City Ordinary Gajuwaka
38J RTC Complex Janata Colony Gurudwara,NAD,BHPV,Gajuwaka,Scindia City Ordinary Steel City
38K RTC Complex Steelplant Sector 5 Gurudwara,NAD,BHPV,Gajuwaka City Ordinary Steel City
99 Collector Office Gajuwaka Jagadamba,Town Kotharoad,Convent,Scindia,Malkapuram City Ordinary Gajuwaka
52E Yendada Village OHPO Rushikonda,Endada,Maddilapalem,RTC,Jagadamba,Town Kotharoad City Ordinary Madhurawada
38IT Kurmannapalem IT Park Gajuwaka,NAD,Gurudwara,RTC,Maddilapalem,Carshed City Ordinary Steel City
38T RTC Complex Steelplant Sector 11 Gurudwara,NAD,BHPV,Gajuwaka,Kurmannapalem City Ordinary Steel City
38M Marikavalasa Kurmannapalem Madhurawada,Maddilapalem,Gurudwara,NAD,BHPV,Gajuwaka City Ordinary Madhurawada
52S/52V Sagar Nagar OHPO Visalakshi Nagar,Maddilapalem,RTC,Jagadamba,Town Kotharoad City Ordinary Madhurawada
25M OHPO Marikavalasa Jagadamba,RTC Complex,Maddilapalem,Endada,Madhurawada City Ordinary Madhurawada
38C RTC Complex Sundarayya Colony Gurudwara,NAD,BHPV,Gajuwaka City Ordinary Gajuwaka
63 RK Beach Dibbapalem Town Kotharoad,Convent,Scindia,Gajuwaka,Pedagantyada City Ordinary Gajuwaka
99K Collector Office Kurmannapalem Jagadamba,Town Kotharoad,Convent,Scindia,Gajuwaka City Ordinary Gajuwaka
38Y RTC Complex Duvvada Railway Station Gurudwara,NAD,BHPV,Gajuwaka,Kurmannapalem City Ordinary Steel City
400S Maddilapalem Narava RTC Complex,Railway Stn,Scindia,Gajuwaka,Kurmannapalem City Ordinary Steel City
77 Collector Office Thanam Jagadamba,Town Kotharoad,Convent,Scindia,Gajuwaka City Ordinary Anakapalli
25P Ratnagiri HB Colony OHPO PM Palem,Endada,Maddilapalem,RTC Complex,Jagadamba City Ordinary Maddilapalem
400K Maddilapalem Duvvada Railway Station RTC,Railway Stn,Scindia,Gajuwaka,Kurmannapalem City Ordinary Steel City
60R RK Beach Arilova Colony Jagadamba,RTC Complex,Maddilapalem City Ordinary Maddilapalem
38N RTC Complex Nadupuru Gurudwara,NAD,BHPV,Gajuwaka,Pedagantyada City Ordinary Anakapalli
500P Anakapalle PM Palem Kurmannapalem,Gajuwaka,Scindia,Convent,RTC,Maddilapalem,Carshed City Ordinary Anakapalli"""

page5_text = """18 50
20 60
20 60
18 55
18 55
28 80
26 70
22 65
32 85
30 85
32 90
18 55
22 65
20 60
28 80
28 80
30 85
22 65
30 85
16 48
26 75
40 105"""

page2_text = """600C RTC Complex Anakapalle Railway Stn,Convent,Gajuwaka,Kurmannapalem,Aganampudi City Ordinary Anakapalli
844 Collector Office Kollivanipalem Jagadamba,Town Kotharoad,Convent,Scindia,Gajuwaka,Parawada City Ordinary Anakapalli
6H RTC Complex Simhachalam Hills Market,Gnanapuram,Gopalapatnam City Ordinary Simhachalam
900T RTC Complex Tagarapuvalasa Waltair,MVP Colony,Rushikonda,GITAM,INS Kalinga Metro Express Madhurawada
28 RK Beach Simhachalam Jagadamba,RTC Complex,NAD,Gopalapatnam City Ordinary Simhachalam
6 Simhachalam OHPO Gopalapatnam,NAD,Kancharapalem,Convent Jn,Town Kotharoad City Ordinary Simhachalam
38H RTC Complex Gantyada HB Colony Airport,Gurudwara,NAD,BHPV,Gajuwaka,Pedagantyada City Ordinary Gajuwaka
69 Arilova Colony Railway Station HB Colony,Sitammadhara,Satyam Jn,RTC Complex City Ordinary Maddilapalem
28R RK Beach Simhachalam Jagadamba,RTC,Railway Stn,NAD,Gopalapatnam City Ordinary Simhachalam
60 Simhachalam OHPO Adavivaram,Maddilapalem,RTC Complex,Jagadamba City Ordinary Simhachalam
6A/H RTC Complex Simhachalam Hills Railway Stn,Kancharapalem,NAD,Gopalapatnam City Ordinary Simhachalam
900 Maddilapalem Railway Station MVP Colony,Waltair,RTC Complex Metro Luxury Maddilapalem
111 Kurmannapalem Tagarapuvalasa Gajuwaka,NAD,Gurudwara,Zoo Park,Madhurawada Metro Express Gajuwaka
1T Vuda Park Kapulatunglam RK Beach,Jagadamba,Town Kotharoad,Convent,Scindia,Gajuwaka City Ordinary Gajuwaka
38D RTC Complex Nadupur Dairy Colony Gurudwara,NAD,BHPV,Gajuwaka,Pedagantyada City Ordinary Gajuwaka
400H Maddilapalem Gantyada HB Colony RTC,Railway Stn,Scindia,Gajuwaka,Pedagantyada City Ordinary Gajuwaka
64A Collector Office Swayambuvaram Jagadamba,Town Kotharoad,Convent,Scindia,Gajuwaka City Ordinary Gajuwaka
20A HB Colony OHPO Sitammadhara,Satyam Jn,RTC,Jagadamba,Town Kotharoad City Ordinary Maddilapalem
540 MVP Complex Simhachalam Maddilapalem,Gurudwara,NAD,Gopalapatnam City Ordinary Maddilapalem
60C Arilova Colony OHPO Maddilapalem,RTC Complex,Jagadamba,Town Kotharoad City Ordinary Maddilapalem
55T Scindia Tagarapuvalasa Malkapuram,Gajuwaka,NAD,Gopalapatnam,Pendurthi,Anandapuram City Ordinary Gajuwaka
65F Fishing Harbour Gangavaram Collector Office,Jagadamba,Scindia,Gajuwaka,Pedagantyada,Dibbapalem City Ordinary Gajuwaka
28Z/H Zilla Parishad Simhachalam Hills Jagadamba,RTC,Gurudwar,NAD,Gopalapatnam City Ordinary Simhachalam
6B OHPO Chintagatla Town Kotharoad,Convent,NAD,Sheelanagar,Narava City Ordinary Simhachalam
28A/28K RK Beach Pendurthi/Kottavalasa GPT,NAD,RTC,Jagadamba,Collector Office City Ordinary Simhachalam
500 RTC Complex Anakapalle Gurudwara,NAD,Gajuwaka,Kurmannapalem,Aganampudi Metro Express Gajuwaka"""

page6_text = """36 95
34 95
14 45
36 90
18 55
18 55
28 80
16 48
20 60
20 60
16 50
14 40
28 80
22 65
24 70
26 75
24 70
18 55
20 60
18 55
36 95
26 75
18 55
20 60
26 75
38 95"""

page3_text = """222 RTC Complex Tagarapuvalasa Maddilapalem,Endada,Madhurawada,Anandapuram City Ordinary Maddilapalem
68/68K RK Beach Pendurthi/Kothavalasa Jagadamba,Asilmetta,Maddilapalem,Arilova,Simhachalam City Ordinary Maddilapalem
222R Railway Station Tagarapuvalasa RTC Complex,Maddilapalem,Madhurawada,Anandapuram City Ordinary Maddilapalem
25D/M OHPO Midhilapuri Colony Jagadamba,RTC Complex,Maddilapalem,Endada,Carshed City Ordinary Maddilapalem
25D/V OHPO Vambey Colony Jagadamba,RTC Complex,Maddilapalem,Endada,Carshed City Ordinary Maddilapalem
25E OHPO Kommadi Jagadamba,RTC Complex,Maddilapalem,Endada,Madhurawada City Ordinary Maddilapalem
25IT RTC Complex IT Park Maddilapalem,Endada,Carshed,Midhilapuri Colony City Ordinary Maddilapalem
25R Railway Station Gurajadanagar RTC Complex,Maddilapalem,Endada,PM Palem City Ordinary Maddilapalem
25S OHPO Nagarapalem Jagadamba,RTC Complex,Maddilapalem,Endada,Carshed City Ordinary Maddilapalem
540M MVP Complex Gajuwaka Maddilapalem,Gurudwara,NAD,BHPV City Ordinary Maddilapalem
12K Town Kotharoad Kothavalasa Railway Stn,Kancharapalem,NAD,GPT,Pendurthi City Ordinary Simhachalam
505 Simhachalam Scindia Gopalapatnam,NAD,Kancharapalem,Convent Jn,Naval Dockyard Metro Express Simhachalam
5D Town Kotharoad Dabbanda Convent,Kancharapalem,NAD,Gopalapatnam,Pendurthi City Ordinary Simhachalam
25G OHPO Ganesh Nagar Jagadamba,RTC Complex,Maddilapalem,Endada,Madhurawada City Ordinary Maddilapalem
25J Railway Station Sevanagar RTC Complex,Maddilapalem,Endada,Madhurawada City Ordinary Maddilapalem
25K OHPO Bakkannapalem Jagadamba,RTC Complex,Maddilapalem,Endada,Madhurawada City Ordinary Maddilapalem
999 RTC Complex Bhimili Maddilapalem,Endada,Madhurawada,Anandapuram City Ordinary Maddilapalem
12D RTC Complex Devarapalle NAD,Gopalapatnam,Pendurthi,Kothavalasa,Anandapuram City Ordinary Simhachalam
28C RK Beach Chintalagraharam Jagadamba,RTC Complex,NAD,Gopalapatnam,Vepagunta City Ordinary Simhachalam
28J RK Beach Sujatanagar Jagadamba,RTC Complex,NAD,Gopalapatnam,Vepagunta City Ordinary Simhachalam
300N Sabbavaram RK Beach Narava,Old Gopalapatnam,NAD,Kancharapalem,RTC Complex City Ordinary Simhachalam
55V Vepada Scindia Simhachalam,Gopalapatnam,NAD,Gajuwaka,Malkapuram City Ordinary Simhachalam
600 Anakapalle Simhachalam Aganampudi,Kurmannapalem,Gajuwaka,NAD,Gopalapatnam Metro Express Simhachalam"""

page7_text = """30 85
28 80
32 90
24 70
22 65
26 75
26 70
26 75
24 70
22 65
28 80
26 75
24 70
28 80
28 80
30 85
34 90
34 95
28 80
28 80
36 95
36 95
36 90"""


page4_text = """38 RTC Complex Gajuwaka Gurudwara,NAD,BHPV City Ordinary Waltair
900K Railway Station Bhimili Waltair,MVP Colony,Rushikonda,GITAM,Mangamaripeta,INS Kalinga Metro Luxury Maddilapalem
777 Simhachalam Anakapalle NAD,Gajuwaka,Aganampudi,Lankelapalem Metro Express Simhachalam
14 Venkojipalem OHPO MVP Colony,Waltair,AU Outgate,Jagadamba,Town Kotharoad City Ordinary Waltair
52D Ravindra Nagar OHPO Adarsha Nagar,Maddilapalem,RTC,Jagadamba,Town Kotharoad City Ordinary Waltair
55 Simhachalam Scindia Gopalapatnam,NAD,BHPV,Gajuwaka,Malkapuram City Ordinary Waltair
10K RTC Complex Kailashagiri Jagadamba,RK Beach,VUDA Park,Tenneti Park Metro Express Waltair
14A Arilova Colony OHPO Venkojipalem,MVP Colony,AU Outgate,Jagadamba,Town Kotharoad City Ordinary Waltair
48 Madhavadhara MN Club Muralinagar,Kailasapuram,Akkayyapalem,RTC Complex,Jagadamba City Ordinary Waltair
48A Madhavadhara OHPO Muralinagar,Kailasapuram,Akkayapalem,RTC Complex,Town Kotharoad City Ordinary Waltair
16 Purna Market Yarada Convent Jn,Scindia,Naval Base City Ordinary Waltair
55K Kothavalasa Scindia Pendurthi,Gopalapatnam,NAD,Gajuwaka,Malkapuram City Ordinary Waltair
10A Visakhapatnam Airport RK Beach NAD,Gurudwara,RTC Complex Metro Express Waltair"""

page8_text = """14 42
32 75
40 100
18 55
20 60
24 70
12 38
20 58
16 48
18 55
20 60
32 90
16 45"""

results = []

def parse_set(route_text, stat_text):
    routes = route_text.strip().split('\n')
    stats = stat_text.strip().split('\n')
    
    for i in range(min(len(routes), len(stats))):
        r = routes[i].strip()
        s = stats[i].strip()
        
        parts = r.split()
        if len(parts) < 5: continue
        
        # Route no is usually the first word
        routeNo = parts[0]
        
        # Stats are Dist_KM Duration_Min
        sparts = s.split()
        if len(sparts) < 2: continue
        distanceKm = int(sparts[0])
        durationMin = int(sparts[1])
        
        # Try to find 'City Ordinary' or 'Metro Express' or 'Metro Luxury'
        btype = "City Ordinary"
        if "Metro Express" in r: btype = "Metro Express"
        elif "Metro Luxury" in r: btype = "Metro Luxury"
        
        via_stops = []
        for p in parts:
            if ',' in p:
                via_stops = p.split(',')
                break
        
        results.append({
            "routeNo": routeNo,
            "type": btype,
            "distanceKm": distanceKm,
            "durationMin": durationMin,
            "via": [v.replace('_', ' ') for v in via_stops]
        })

parse_set(page1_text, page5_text)
parse_set(page2_text, page6_text)
parse_set(page3_text, page7_text)
parse_set(page4_text, page8_text)

# We will just write a simple JS export
js_content = "export const APSRTC_SCHEDULES = " + json.dumps(results, indent=2) + ";\\n\\n"
js_content += """
export function getScheduleByRoute(routeNo) {
  if (!routeNo) return null;
  const match = APSRTC_SCHEDULES.find((r) => r.routeNo.toLowerCase() === routeNo.toLowerCase());
  if (!match) {
    const fallback = APSRTC_SCHEDULES.find((r) => {
        let normR = r.routeNo.toLowerCase().replace('/', '');
        let normQ = routeNo.toLowerCase().replace('/', '');
        return normR.includes(normQ) || normQ.includes(normR);
    });
    return fallback || null;
  }
  return match;
}
"""

with open(r'c:\\Users\\kames\\Desktop\\Giridhar\\transitflow\\src\\data\\apsrtc_schedules.js', 'w') as f:
    f.write(js_content)

print(f"Generated {len(results)} schedules!")
