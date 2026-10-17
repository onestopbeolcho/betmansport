"""
Betman (Korean) ↔ English team name mapper & Full Korean Display Mapper.
Covers all 17+ major leagues tracked by Scorenix (Soccer, MLB, NBA, NHL).

Matching & Localization strategy:
  1. TEAM_DISPLAY_EN_TO_KO: Full English name -> Full Standard Korean name (for UI, AI reports, SEO, Shorts)
  2. TEAM_MAP_KR_TO_EN: Betman 3-4 char Korean abbreviation -> Full English name (for domestic Betman crawler matching)
  3. BETMAN_ABBR_TO_FULL_KO: Betman 3-4 char Korean abbreviation -> Full Standard Korean name
  4. Accent-insensitive (NFKD) normalization without false-positive cross-sport substring collisions
"""
from typing import Dict, Optional
import re
import unicodedata


# ─────────────────────────────────────────────────────────────────────────────
# 1. Full English Team Name → Standard Full Korean Team Name (Platform Display)
# ─────────────────────────────────────────────────────────────────────────────
TEAM_DISPLAY_EN_TO_KO: Dict[str, str] = {
    # ═══ EPL & English Football (프리미어리그 / 챔피언십) ═══
    "AFC Bournemouth": "본머스",
    "Bournemouth": "본머스",
    "Arsenal": "아스널",
    "Aston Villa": "애스턴 빌라",
    "Brentford": "브렌트포드",
    "Brighton & Hove Albion": "브라이튼",
    "Brighton and Hove Albion": "브라이튼",
    "Brighton": "브라이튼",
    "Burnley": "번리",
    "Chelsea": "첼시",
    "Coventry City": "코번트리 시티",
    "Crystal Palace": "크리스탈 팰리스",
    "Everton": "에버턴",
    "Fulham": "풀럼",
    "Hull City": "헐 시티",
    "Ipswich Town": "입스위치 타운",
    "Leeds United": "리즈 유나이티드",
    "Leicester City": "레스터 시티",
    "Liverpool": "리버풀",
    "Luton Town": "루턴 타운",
    "Manchester City": "맨체스터 시티",
    "Man City": "맨체스터 시티",
    "Manchester United": "맨체스터 유나이티드",
    "Man United": "맨체스터 유나이티드",
    "Man Utd": "맨체스터 유나이티드",
    "Middlesbrough": "미들즈브러",
    "Millwall": "밀월",
    "Newcastle United": "뉴캐슬 유나이티드",
    "Newcastle": "뉴캐슬 유나이티드",
    "Norwich City": "노리치 시티",
    "Nottingham Forest": "노팅엄 포레스트",
    "Oxford United": "옥스퍼드 유나이티드",
    "Plymouth Argyle": "플리머스 아가일",
    "Portsmouth": "포츠머스",
    "Preston North End": "프레스턴 노스 엔드",
    "Queens Park Rangers": "퀸즈 파크 레인저스",
    "Sheffield United": "셰필드 유나이티드",
    "Sheffield Wednesday": "셰필드 웬즈데이",
    "Southampton": "사우샘프턴",
    "Stoke City": "스토크 시티",
    "Sunderland": "선덜랜드",
    "Swansea City": "스완지 시티",
    "Tottenham Hotspur": "토트넘 홋스퍼",
    "Tottenham": "토트넘 홋스퍼",
    "Watford": "왓포드",
    "West Bromwich Albion": "웨스트브로미치 앨비언",
    "West Ham United": "웨스트햄 유나이티드",
    "West Ham": "웨스트햄 유나이티드",
    "Wolverhampton Wanderers": "울버햄튼 원더러스",
    "Wolverhampton": "울버햄튼 원더러스",
    "Wolves": "울버햄튼 원더러스",
    "Blackburn Rovers": "블랙번 로버스",
    "Birmingham City": "버밍엄 시티",
    "Bristol City": "브리스톨 시티",
    "Cardiff City": "카디프 시티",
    "Derby County": "더비 카운티",
    "Huddersfield Town": "허더즈필드 타운",
    "Rotherham United": "로더럼 유나이티드",

    # ═══ La Liga (라리가) ═══
    "Alavés": "알라베스",
    "Deportivo Alaves": "알라베스",
    "Deportivo Alavés": "알라베스",
    "Athletic Club": "아틀레틱 빌바오",
    "Athletic Bilbao": "아틀레틱 빌바오",
    "Atlético Madrid": "아틀레티코 마드리드",
    "Atletico Madrid": "아틀레티코 마드리드",
    "Barcelona": "바르셀로나",
    "FC Barcelona": "바르셀로나",
    "Celta Vigo": "셀타 비고",
    "RC Celta": "셀타 비고",
    "Deportivo": "데포르티보",
    "Deportivo La Coruna": "데포르티보",
    "Elche": "엘체",
    "Elche CF": "엘체",
    "Espanyol": "에스파뇰",
    "RCD Espanyol": "에스파뇰",
    "Getafe": "헤타페",
    "Getafe CF": "헤타페",
    "Girona FC": "지로나",
    "Girona": "지로나",
    "Las Palmas": "라스팔마스",
    "UD Las Palmas": "라스팔마스",
    "CD Leganes": "레가네스",
    "Leganés": "레가네스",
    "Levante": "레반테",
    "Levante UD": "레반테",
    "Málaga": "말라가",
    "Malaga": "말라가",
    "RCD Mallorca": "마요르카",
    "Mallorca": "마요르카",
    "Osasuna": "오사수나",
    "CA Osasuna": "오사수나",
    "Racing Santander": "라싱 산탄데르",
    "Rayo Vallecano": "라요 바예카노",
    "Real Betis": "레알 베티스",
    "Real Madrid": "레알 마드리드",
    "Real Oviedo": "레알 오비에도",
    "Real Sociedad": "레알 소시에다드",
    "Real Valladolid": "레알 바야돌리드",
    "Sevilla": "세비야",
    "Sevilla FC": "세비야",
    "Valencia": "발렌시아",
    "Valencia CF": "발렌시아",
    "Villarreal": "비야레알",
    "Villarreal CF": "비야레알",
    "Cadiz CF": "카디스",
    "Granada CF": "그라나다",
    "UD Almeria": "알메리아",

    # ═══ Bundesliga (분데스리가) ═══
    "1. FC Union Berlin": "우니온 베를린",
    "Union Berlin": "우니온 베를린",
    "Bayer Leverkusen": "레버쿠젠",
    "Bayer 04 Leverkusen": "레버쿠젠",
    "Bayern Munich": "바이에른 뮌헨",
    "FC Bayern Munich": "바이에른 뮌헨",
    "Borussia Dortmund": "도르트문트",
    "Borussia Mönchengladbach": "묀헨글라트바흐",
    "Borussia Monchengladbach": "묀헨글라트바흐",
    "Eintracht Frankfurt": "프랑크푸르트",
    "FC Augsburg": "아우크스부르크",
    "FC Cologne": "FC 쾰른",
    "FC Koln": "FC 쾰른",
    "1. FC Köln": "FC 쾰른",
    "Hamburg SV": "함부르크 SV",
    "Hamburger SV": "함부르크 SV",
    "Mainz": "마인츠 05",
    "1. FSV Mainz 05": "마인츠 05",
    "Mainz 05": "마인츠 05",
    "RB Leipzig": "RB 라이프치히",
    "SC Freiburg": "프라이부르크",
    "SC Paderborn 07": "파더보른 07",
    "SV Elversberg": "엘페르스베르크",
    "Schalke 04": "샬케 04",
    "FC Schalke 04": "샬케 04",
    "TSG Hoffenheim": "호펜하임",
    "Hoffenheim": "호펜하임",
    "VfB Stuttgart": "슈투트가르트",
    "VfL Wolfsburg": "볼프스부르크",
    "VfL Bochum": "보훔",
    "Werder Bremen": "베르더 브레멘",
    "1. FC Heidenheim": "하이덴하임",
    "SV Darmstadt 98": "다름슈타트",
    "FC St. Pauli": "장크트파울리",
    "1. FC Nurnberg": "뉘른베르크",
    "Hertha BSC": "헤르타 베를린",
    "1. FC Kaiserslautern": "카이저슬라우테른",
    "Holstein Kiel": "홀슈타인 킬",
    "SpVgg Greuther Furth": "그로이터 퓌르트",

    # ═══ Serie A (세리에 A) ═══
    "AC Milan": "AC 밀란",
    "AS Roma": "AS 로마",
    "Roma": "AS 로마",
    "Atalanta": "아탈란타",
    "Atalanta BC": "아탈란타",
    "Bologna": "볼로냐",
    "Bologna FC": "볼로냐",
    "Cagliari": "칼리아리",
    "Como": "코모 1907",
    "Como 1907": "코모 1907",
    "Empoli FC": "엠폴리",
    "Empoli": "엠폴리",
    "Fiorentina": "피오렌티나",
    "ACF Fiorentina": "피오렌티나",
    "Frosinone": "프로시노네",
    "Genoa": "제노아",
    "Genoa CFC": "제노아",
    "Hellas Verona": "엘라스 베로나",
    "Verona": "엘라스 베로나",
    "Internazionale": "인테르",
    "Inter Milan": "인테르",
    "Inter": "인테르",
    "Juventus": "유벤투스",
    "Lazio": "라치오",
    "SS Lazio": "라치오",
    "Lecce": "레체",
    "US Lecce": "레체",
    "Monza": "몬차",
    "AC Monza": "몬차",
    "Napoli": "나폴리",
    "SSC Napoli": "나폴리",
    "Parma": "파르마",
    "Parma Calcio 1913": "파르마",
    "Salernitana": "살레르니타나",
    "Sassuolo": "사수올로",
    "US Sassuolo": "사수올로",
    "Torino": "토리노",
    "Torino FC": "토리노",
    "Udinese": "우디네세",
    "Venezia": "베네치아",
    "Venezia FC": "베네치아",
    "US Cremonese": "크레모네세",

    # ═══ Ligue 1 (리그 1) ═══
    "AJ Auxerre": "오세르",
    "Auxerre": "오세르",
    "AS Monaco": "AS 모나코",
    "Monaco": "AS 모나코",
    "Angers": "앙제 SCO",
    "Angers SCO": "앙제 SCO",
    "Brest": "브레스트",
    "Stade Brestois 29": "브레스트",
    "Clermont Foot": "클레르몽",
    "Le Havre AC": "르아브르",
    "Le Havre": "르아브르",
    "Le Mans": "르망",
    "Lens": "RC 랑스",
    "RC Lens": "RC 랑스",
    "Lille": "릴 OSC",
    "Lille OSC": "릴 OSC",
    "Lorient": "로리앙",
    "FC Lorient": "로리앙",
    "Lyon": "올림피크 리옹",
    "Olympique Lyonnais": "올림피크 리옹",
    "Marseille": "올림피크 마르세유",
    "Olympique Marseille": "올림피크 마르세유",
    "FC Metz": "FC 메스",
    "Metz": "FC 메스",
    "Montpellier HSC": "몽펠리에",
    "FC Nantes": "FC 낭트",
    "Nantes": "FC 낭트",
    "Nice": "OGC 니스",
    "OGC Nice": "OGC 니스",
    "Paris FC": "파리 FC",
    "Paris Saint-Germain": "파리 생제르맹",
    "PSG": "파리 생제르맹",
    "Stade de Reims": "스타드 랭스",
    "Reims": "스타드 랭스",
    "Stade Rennais": "스타드 렌",
    "Rennes": "스타드 렌",
    "AS Saint-Etienne": "생테티엔",
    "Strasbourg": "스트라스부르",
    "RC Strasbourg": "스트라스부르",
    "Toulouse": "툴루즈",
    "Toulouse FC": "툴루즈",
    "Troyes": "트루아",

    # ═══ Eredivisie (에레디비시) ═══
    "ADO Den Haag": "덴하흐",
    "AZ Alkmaar": "AZ 알크마르",
    "Ajax Amsterdam": "아약스",
    "Ajax": "아약스",
    "Excelsior": "엑셀시오르",
    "FC Emmen": "FC 에먼",
    "FC Groningen": "흐로닝언",
    "FC Twente": "FC 트벤테",
    "FC Utrecht": "위트레흐트",
    "FC Volendam": "폴렌담",
    "Feyenoord Rotterdam": "페예노르트",
    "Feyenoord": "페예노르트",
    "Fortuna Sittard": "포르투나 시타르트",
    "Go Ahead Eagles": "고 어헤드 이글스",
    "Heerenveen": "헤이렌베인",
    "SC Heerenveen": "헤이렌베인",
    "Heracles Almelo": "헤라클레스 알멜로",
    "NAC Breda": "NAC 브레다",
    "NEC Nijmegen": "NEC 네이메헌",
    "PEC Zwolle": "PEC 즈볼러",
    "PSV Eindhoven": "PSV 에인트호번",
    "PSV": "PSV 에인트호번",
    "RKC Waalwijk": "발베이크",
    "SC Cambuur": "캄뷔르",
    "SC Telstar": "텔스타",
    "Telstar": "텔스타",
    "Sparta Rotterdam": "스파르타 로테르담",
    "Vitesse": "비테세",
    "Willem II": "빌럼 II",

    # ═══ Liga Portugal (포르투갈 리가) ═══
    "Académico de Viseu": "아카데미코 비제우",
    "Alverca": "알베르카",
    "Arouca": "아로카",
    "Benfica": "벤피카",
    "SL Benfica": "벤피카",
    "Braga": "SC 브라가",
    "SC Braga": "SC 브라가",
    "C.D. Nacional": "나시오날",
    "Casa Pia": "카사 피아",
    "Estoril": "이스토릴",
    "Estrela": "이스트렐라",
    "FC Famalicao": "파말리캉",
    "FC Porto": "FC 포르투",
    "Porto": "FC 포르투",
    "Gil Vicente": "질 비센트",
    "Maritimo": "마리티무",
    "Moreirense": "모레이렌스",
    "Rio Ave": "히우 아브",
    "Santa Clara": "산타 클라라",
    "Sporting CP": "스포르팅 CP",
    "Torreense": "토렌스",
    "Vitória de Guimaraes": "비토리아 기마랑이스",

    # ═══ UEFA Champions League / Europa League (유럽 대항전 추가 클럽) ═══
    "AEK Athens": "AEK 아테네",
    "Anderlecht": "안데를레흐트",
    "Ararat-Armenia": "아라라트 아르메니아",
    "Besiktas": "베식타스",
    "Bodo/Glimt": "보되/글림트",
    "Bodø/Glimt": "보되/글림트",
    "Celtic": "셀틱",
    "Club Brugge": "클뤼브 브뤼허",
    "Dinamo Zagreb": "디나모 자그레브",
    "Fenerbahce": "페네르바체",
    "Fenerbahçe": "페네르바체",
    "Ferencvaros": "페렌츠바로시",
    "Galatasaray": "갈라타사라이",
    "Hapoel Be'er": "하포엘 베르셰바",
    "Jagiellonia Bialystok": "야기엘로니아",
    "LASK Linz": "LASK 린츠",
    "Lech Poznan": "레흐 포즈난",
    "Levski Sofia": "레프스키 소피아",
    "Lillestrom": "릴레스트륌",
    "NK Celje": "NK 첼리에",
    "OFI Crete": "OFI 크레타",
    "Olympiacos": "올림피아코스",
    "Omonia Nicosia": "오모니아 니코시아",
    "RB Salzburg": "레드불 잘츠부르크",
    "Red Bull Salzburg": "레드불 잘츠부르크",
    "Rangers": "레인저스 FC",
    "SK Sturm Graz": "슈투름 그라츠",
    "Sabah FK": "사바 FK",
    "Shakhtar Donetsk": "샤흐타르 도네츠크",
    "Slavia Prague": "슬라비아 프라하",
    "Slovan Bratislava": "슬로반 브라티슬라바",
    "Sparta Prague": "스파르타 프라하",
    "Union St.-Gilloise": "위니옹 생질루아즈",
    "VIKING FK": "바이킹 FK",
    "Viktoria Plzen": "빅토리아 플젠",

    # ═══ Brasileirão Série A (브라질 세리에 A) ═══
    "Athletico Paranaense": "아틀레치쿠 파라나엔시",
    "Athletico-PR": "아틀레치쿠 파라나엔시",
    "Atlético-MG": "아틀레치쿠 미네이루",
    "Atletico Mineiro": "아틀레치쿠 미네이루",
    "Bahia": "바이아",
    "Botafogo": "보타포구",
    "Chapecoense": "샤페코엔시",
    "Corinthians": "코린치안스",
    "Coritiba": "코리치바",
    "Cruzeiro": "크루제이루",
    "Flamengo": "플라멩구",
    "Fluminense": "플루미넨시",
    "Grêmio": "그레미우",
    "Gremio": "그레미우",
    "Internacional": "인테르나시오나우",
    "Mirassol": "미라소우",
    "Palmeiras": "파우메이라스",
    "Red Bull Bragantino": "레드불 브라간치누",
    "Remo": "헤무",
    "Santos": "산투스",
    "São Paulo": "상파울루",
    "Sao Paulo": "상파울루",
    "Vasco da Gama": "바스쿠 다 가마",
    "Vitória": "비토리아",

    # ═══ Liga MX (멕시코 리가 MX) ═══
    "América": "클럽 아메리카",
    "Club América": "클럽 아메리카",
    "Atlante": "아틀란테",
    "Atlas": "아틀라스",
    "Atlético de San Luis": "아틀레티코 산루이스",
    "Cruz Azul": "크루스 아술",
    "FC Juárez": "FC 후아레스",
    "Guadalajara": "과달라하라 치바스",
    "León": "클루브 레온",
    "Monterrey": "몬테레이",
    "Necaxa": "네칵사",
    "Pachuca": "파추카",
    "Puebla": "푸에블라",
    "Pumas UNAM": "푸마스 UNAM",
    "Querétaro": "케레타로",
    "Tigres UANL": "티그레스 UANL",
    "Tijuana": "티후아나",
    "Toluca": "톨루카",

    # ═══ MLS (미국 메이저리그 사커) ═══
    "Atlanta United FC": "애틀랜타 유나이티드",
    "Austin FC": "오스틴 FC",
    "CF Montréal": "CF 몬트리올",
    "CF Montreal": "CF 몬트리올",
    "Charlotte FC": "샬럿 FC",
    "Chicago Fire FC": "시카고 파이어",
    "Colorado Rapids": "콜로라도 래피즈",
    "Columbus Crew": "콜럼버스 크루",
    "D.C. United": "DC 유나이티드",
    "FC Cincinnati": "FC 신시내티",
    "FC Dallas": "FC 댈러스",
    "Houston Dynamo FC": "휴스턴 다이나모",
    "Inter Miami CF": "인터 마이애미",
    "LA Galaxy": "LA 갤럭시",
    "LAFC": "로스앤젤레스 FC",
    "Los Angeles FC": "로스앤젤레스 FC",
    "Minnesota United FC": "미네소타 유나이티드",
    "Nashville SC": "내슈빌 SC",
    "New England Revolution": "뉴잉글랜드 레볼루션",
    "New York City FC": "뉴욕 시티 FC",
    "New York Red Bulls": "뉴욕 레드불스",
    "Red Bull New York": "뉴욕 레드불스",
    "Orlando City SC": "올랜도 시티",
    "Philadelphia Union": "필라델피아 유니언",
    "Portland Timbers": "포틀랜드 팀버스",
    "Real Salt Lake": "레알 솔트레이크",
    "San Diego FC": "샌디에이고 FC",
    "San Jose Earthquakes": "산호세 어스퀘이크스",
    "Seattle Sounders FC": "시애틀 사운더스",
    "Sporting Kansas City": "스포르팅 캔자스시티",
    "St. Louis CITY SC": "세인트루이스 시티",
    "Toronto FC": "토론토 FC",
    "Vancouver Whitecaps": "밴쿠버 화이트캡스",

    # ═══ K League 1 & J1 League (아시아 축구) ═══
    "Jeonbuk Hyundai Motors": "전북 현대",
    "Ulsan Hyundai": "울산 HD",
    "Ulsan HD": "울산 HD",
    "Pohang Steelers": "포항 스틸러스",
    "Daegu FC": "대구 FC",
    "Incheon United": "인천 유나이티드",
    "Suwon FC": "수원 FC",
    "Suwon Samsung Bluewings": "수원 삼성",
    "Jeju United": "제주 유나이티드",
    "Gangwon FC": "강원 FC",
    "Gwangju FC": "광주 FC",
    "FC Seoul": "FC 서울",
    "Gimcheon Sangmu": "김천 상무",
    "Daejeon Hana Citizen": "대전 하나 시티즌",
    "FC Anyang": "FC 안양",
    "Avispa Fukuoka": "아비스파 후쿠오카",
    "Cerezo Osaka": "세레소 오사카",
    "FC Tokyo": "FC 도쿄",
    "Fagiano Okayama": "파지아노 오카야마",
    "Gamba Osaka": "감바 오사카",
    "JEF United Ichihara-Chiba": "제프 유나이티드 지바",
    "JEF United Chiba": "제프 유나이티드 지바",
    "Kashima Antlers": "가시마 앤틀러스",
    "Kashiwa Reysol": "가시와 레이솔",
    "Kawasaki Frontale": "가와사키 프론탈레",
    "Kyoto Sanga": "교토 상가",
    "Machida Zelvia": "마치다 젤비아",
    "Mito Hollyhock": "미토 홀리호크",
    "Nagoya Grampus": "나고야 그램퍼스",
    "Sanfrecce Hiroshima": "산프레체 히로시마",
    "Shimizu S-Pulse": "시미즈 에스펄스",
    "Tokyo Verdy 1969": "도쿄 베르디",
    "Urawa Red Diamonds": "우라와 레즈",
    "V-Varen Nagasaki": "V-파렌 나가사키",
    "Vissel Kobe": "비셀 고베",
    "Yokohama F. Marinos": "요코하마 F. 마리노스",
    "Albirex Niigata": "알비렉스 니가타",
    "Blaublitz Akita": "블라우블리츠 아키타",
    "Tochigi SC": "도치기 SC",
    "Tokushima Vortis": "도쿠시마 보르티스",

    # ═══ MLB (메이저리그 야구 30개 구단) ═══
    "Arizona Diamondbacks": "애리조나 다이아몬드백스",
    "Athletics": "오클랜드 애슬레틱스",
    "Oakland Athletics": "오클랜드 애슬레틱스",
    "Atlanta Braves": "애틀랜타 브레이브스",
    "Baltimore Orioles": "볼티모어 오리올스",
    "Boston Red Sox": "보스턴 레드삭스",
    "Chicago Cubs": "시카고 컵스",
    "Chicago White Sox": "시카고 화이트삭스",
    "Cincinnati Reds": "신시내티 레즈",
    "Cleveland Guardians": "클리블랜드 가디언스",
    "Colorado Rockies": "콜로라도 로키스",
    "Detroit Tigers": "디트로이트 타이거스",
    "Houston Astros": "휴스턴 애스트로스",
    "Kansas City Royals": "캔자스시티 로열스",
    "Los Angeles Angels": "LA 에인절스",
    "Los Angeles Dodgers": "LA 다저스",
    "Miami Marlins": "마이애미 말린스",
    "Milwaukee Brewers": "밀워키 브루어스",
    "Minnesota Twins": "미네소타 트윈스",
    "New York Mets": "뉴욕 메츠",
    "New York Yankees": "뉴욕 양키스",
    "Philadelphia Phillies": "필라델피아 필리스",
    "Pittsburgh Pirates": "피츠버그 파이리츠",
    "San Diego Padres": "샌디에이고 파드리스",
    "San Francisco Giants": "샌프란시스코 자이언츠",
    "Seattle Mariners": "시애틀 매리너스",
    "St. Louis Cardinals": "세인트루이스 카디널스",
    "Tampa Bay Rays": "탬파베이 레이스",
    "Texas Rangers": "텍사스 레인저스",
    "Toronto Blue Jays": "토론토 블루제이스",
    "Washington Nationals": "워싱턴 내셔널스",

    # ═══ NBA (미국 프로농구 30개 구단) ═══
    "Atlanta Hawks": "애틀랜타 호크스",
    "Boston Celtics": "보스턴 셀틱스",
    "Brooklyn Nets": "브루클린 네츠",
    "Charlotte Hornets": "샬럿 호네츠",
    "Chicago Bulls": "시카고 불스",
    "Cleveland Cavaliers": "클리블랜드 캐벌리어스",
    "Dallas Mavericks": "댈러스 매버릭스",
    "Denver Nuggets": "덴버 너기츠",
    "Detroit Pistons": "디트로이트 피스톤스",
    "Golden State Warriors": "골든스테이트 워리어스",
    "Houston Rockets": "휴스턴 로키츠",
    "Indiana Pacers": "인디애나 페이서스",
    "LA Clippers": "LA 클리퍼스",
    "Los Angeles Clippers": "LA 클리퍼스",
    "Los Angeles Lakers": "LA 레이커스",
    "LA Lakers": "LA 레이커스",
    "Memphis Grizzlies": "멤피스 그리즐리스",
    "Miami Heat": "마이애미 히트",
    "Milwaukee Bucks": "밀워키 벅스",
    "Minnesota Timberwolves": "미네소타 팀버울브스",
    "New Orleans Pelicans": "뉴올리언스 펠리컨스",
    "New York Knicks": "뉴욕 닉스",
    "Oklahoma City Thunder": "오클라호마시티 선더",
    "Orlando Magic": "올랜도 매직",
    "Philadelphia 76ers": "필라델피아 세븐티식서스",
    "Phoenix Suns": "피닉스 선즈",
    "Portland Trail Blazers": "포틀랜드 트레일블레이저스",
    "Sacramento Kings": "새크라멘토 킹스",
    "San Antonio Spurs": "샌안토니오 스퍼스",
    "Toronto Raptors": "토론토 랩터스",
    "Utah Jazz": "유타 재즈",
    "Washington Wizards": "워싱턴 위저즈",

    # ═══ NHL (북미 아이스하키 32개 구단) ═══
    "Anaheim Ducks": "애너하임 덕스",
    "Boston Bruins": "보스턴 브루인스",
    "Buffalo Sabres": "버팔로 세이버스",
    "Calgary Flames": "캘거리 플레임스",
    "Carolina Hurricanes": "캐롤라이나 허리케인스",
    "Chicago Blackhawks": "시카고 블랙호크스",
    "Colorado Avalanche": "콜로라도 애벌랜치",
    "Columbus Blue Jackets": "콜럼버스 블루재키츠",
    "Dallas Stars": "댈러스 스타스",
    "Detroit Red Wings": "디트로이트 레드윙스",
    "Edmonton Oilers": "에드먼턴 오일러스",
    "Florida Panthers": "플로리다 팬서스",
    "Los Angeles Kings": "LA 킹스",
    "Minnesota Wild": "미네소타 와일드",
    "Montreal Canadiens": "몬트리올 캐네디언스",
    "Montréal Canadiens": "몬트리올 캐네디언스",
    "Nashville Predators": "내슈빌 프레데터스",
    "New Jersey Devils": "뉴저지 데블스",
    "New York Islanders": "뉴욕 아일랜더스",
    "New York Rangers": "뉴욕 레인저스",
    "Ottawa Senators": "오타와 세네터스",
    "Philadelphia Flyers": "필라델피아 플라이어스",
    "Pittsburgh Penguins": "피츠버그 펭귄스",
    "San Jose Sharks": "산호세 샤크스",
    "Seattle Kraken": "시애틀 크라켄",
    "St. Louis Blues": "세인트루이스 블루스",
    "Tampa Bay Lightning": "탬파베이 라이트닝",
    "Toronto Maple Leafs": "토론토 메이플리프스",
    "Utah Hockey Club": "유타 하키클럽",
    "Utah Mammoth": "유타 매머드",
    "Vancouver Canucks": "밴쿠버 캐넉스",
    "Vegas Golden Knights": "베가스 골든나이츠",
    "Washington Capitals": "워싱턴 캐피털스",
    "Winnipeg Jets": "위니펙 제츠",
}


# ─────────────────────────────────────────────────────────────────────────────
# 2. Betman (Korean 3-4 char abbreviation) → Full English name
# ─────────────────────────────────────────────────────────────────────────────
TEAM_MAP_KR_TO_EN: Dict[str, str] = {
    # ═══ EPL ═══
    "맨시티": "Manchester City",
    "리버풀": "Liverpool",
    "아스널": "Arsenal",
    "첼시": "Chelsea",
    "토트넘": "Tottenham Hotspur",
    "맨유": "Manchester United",
    "뉴캐슬U": "Newcastle United",
    "A빌라": "Aston Villa",
    "브라이턴": "Brighton & Hove Albion",
    "웨스햄": "West Ham United",
    "풀럼": "Fulham",
    "본머스": "AFC Bournemouth",
    "크리스탈": "Crystal Palace",
    "노팅엄": "Nottingham Forest",
    "울버햄프": "Wolverhampton Wanderers",
    "에버턴": "Everton",
    "번리": "Burnley",
    "셰필드U": "Sheffield United",
    "루턴타운": "Luton Town",
    "레스터C": "Leicester City",
    "브렌트포": "Brentford",
    "사우샘프": "Southampton",
    "이프스위": "Ipswich Town",

    # ═══ La Liga ═══
    "레알마드": "Real Madrid",
    "바르셀로": "Barcelona",
    "AT마드": "Atlético Madrid",
    "소시에다": "Real Sociedad",
    "비야레알": "Villarreal",
    "베티스": "Real Betis",
    "세비야": "Sevilla",
    "발렌시아": "Valencia",
    "셀타비고": "Celta Vigo",
    "RC셀타": "Celta Vigo",
    "에스파뇰": "Espanyol",
    "마요르카": "RCD Mallorca",
    "라요": "Rayo Vallecano",
    "오사수나": "Osasuna",
    "알라베스": "Alavés",
    "카디스": "Cadiz CF",
    "그라나다": "Granada CF",
    "알메리아": "UD Almeria",
    "라스팔마": "Las Palmas",
    "헤타페": "Getafe",
    "오비에도": "Real Oviedo",
    "레반테": "Levante",
    "발라돌리": "Real Valladolid",
    "빌바오": "Athletic Club",
    "히로나": "Girona FC",
    "레가네스": "CD Leganes",

    # ═══ Bundesliga ═══
    "바이뮌헨": "Bayern Munich",
    "도르트문": "Borussia Dortmund",
    "레버쿠젠": "Bayer Leverkusen",
    "라이프치": "RB Leipzig",
    "프랑크푸": "Eintracht Frankfurt",
    "슈투트가": "VfB Stuttgart",
    "프라이부": "SC Freiburg",
    "볼프스부": "VfL Wolfsburg",
    "묀헨글라": "Borussia Mönchengladbach",
    "호펜하임": "TSG Hoffenheim",
    "브레멘": "Werder Bremen",
    "아우크스": "FC Augsburg",
    "하이덴하": "1. FC Heidenheim",
    "U베를린": "1. FC Union Berlin",
    "보훔": "VfL Bochum",
    "다름슈타": "SV Darmstadt 98",
    "쾰른": "FC Cologne",
    "마인츠": "Mainz",
    "장크트파": "FC St. Pauli",
    "함부르크": "Hamburg SV",
    "뉘른베르": "1. FC Nurnberg",
    "헤르타": "Hertha BSC",
    "카이저스": "1. FC Kaiserslautern",
    "킬FK": "Holstein Kiel",
    "그로이터": "SpVgg Greuther Furth",

    # ═══ Serie A ═══
    "인테르": "Internazionale",
    "유벤투스": "Juventus",
    "나폴리": "Napoli",
    "AC밀란": "AC Milan",
    "AS로마": "AS Roma",
    "라치오": "Lazio",
    "아탈란타": "Atalanta",
    "피오렌티": "Fiorentina",
    "볼로냐": "Bologna",
    "토리노": "Torino",
    "우디네세": "Udinese",
    "사수올로": "Sassuolo",
    "제노아": "Genoa",
    "칼리아리": "Cagliari",
    "엠폴리": "Empoli FC",
    "살레르니": "Salernitana",
    "프로시노": "Frosinone",
    "레체": "Lecce",
    "베로나": "Hellas Verona",
    "몬차": "Monza",
    "코모1907": "Como",
    "파르마": "Parma",
    "베네치아": "Venezia",
    "크레모네": "US Cremonese",
    "엘라스": "Hellas Verona",

    # ═══ Ligue 1 ═══
    "파리SG": "Paris Saint-Germain",
    "PSG": "Paris Saint-Germain",
    "마르세유": "Marseille",
    "리옹": "Lyon",
    "릴OSC": "Lille",
    "모나코": "AS Monaco",
    "랑스": "Lens",
    "OGC니스": "Nice",
    "RC스트라": "Strasbourg",
    "렌": "Stade Rennais",
    "낭트": "FC Nantes",
    "몽펠리에": "Montpellier HSC",
    "툴루즈": "Toulouse",
    "르아브르": "Le Havre AC",
    "브레스투": "Brest",
    "로리앙": "Lorient",
    "메스": "FC Metz",
    "클레르몽": "Clermont Foot",
    "오세르": "AJ Auxerre",
    "앙제SCO": "Angers",
    "파리FC": "Paris FC",
    "앙제": "Angers",
    "생테티엔": "AS Saint-Etienne",

    # ═══ Eredivisie ═══
    "아약스": "Ajax Amsterdam",
    "PSV": "PSV Eindhoven",
    "페예노르": "Feyenoord Rotterdam",
    "알크마르": "AZ Alkmaar",
    "트벤테": "FC Twente",
    "위트레흐": "FC Utrecht",
    "흐로닝언": "FC Groningen",
    "헤이렌베": "Heerenveen",
    "즈볼러": "PEC Zwolle",
    "엑셀시오": "Excelsior",
    "스파로테": "Sparta Rotterdam",
    "고어헤드": "Go Ahead Eagles",
    "네이메헌": "NEC Nijmegen",
    "브레다": "NAC Breda",
    "텔스타": "Telstar",
    "헤라클레": "Heracles Almelo",
    "F시타르": "Fortuna Sittard",
    "비테서": "Vitesse",
    "볼렌담": "FC Volendam",
    "발베이크": "RKC Waalwijk",
    "캄뷔르": "SC Cambuur",
    "에먼": "FC Emmen",
    "빌럼II": "Willem II",

    # ═══ EFL Championship ═══
    "리즈U": "Leeds United",
    "선덜랜드": "Sunderland",
    "노리치C": "Norwich City",
    "밀월": "Millwall",
    "왓포드": "Watford",
    "퀸즈파크": "Queens Park Rangers",
    "블랙번": "Blackburn Rovers",
    "스토크C": "Stoke City",
    "버밍엄C": "Birmingham City",
    "더비카운": "Derby County",
    "스완지C": "Swansea City",
    "옥스퍼드": "Oxford United",
    "프레스턴": "Preston North End",
    "셰필드웬": "Sheffield Wednesday",
    "포츠머스": "Portsmouth",
    "웨스브로": "West Bromwich Albion",
    "코번트리": "Coventry City",
    "미들즈브": "Middlesbrough",
    "플리머스": "Plymouth Argyle",
    "브리스톨": "Bristol City",
    "로식데일": "Rotherham United",
    "카디프C": "Cardiff City",
    "허더즈필": "Huddersfield Town",

    # ═══ J-League & K-League ═══
    "가와사키": "Kawasaki Frontale",
    "가시와": "Kashiwa Reysol",
    "G오사카": "Gamba Osaka",
    "C오사카": "Cerezo Osaka",
    "나고야": "Nagoya Grampus",
    "도쿄베르": "FC Tokyo",
    "요코하마M": "Yokohama F. Marinos",
    "우라와레": "Urawa Red Diamonds",
    "산프레체": "Sanfrecce Hiroshima",
    "비셀고베": "Vissel Kobe",
    "후쿠오카": "Avispa Fukuoka",
    "아키타": "Blaublitz Akita",
    "도치기시": "Tochigi SC",
    "도쿠시마": "Tokushima Vortis",
    "니가타": "Albirex Niigata",
    "제프유나": "JEF United Ichihara-Chiba",
    "전북현대": "Jeonbuk Hyundai Motors",
    "울산현대": "Ulsan Hyundai",
    "포항스틸": "Pohang Steelers",
    "대구FC": "Daegu FC",
    "인천유나": "Incheon United",
    "수원FC": "Suwon FC",
    "수삼성": "Suwon Samsung Bluewings",
    "제주유나": "Jeju United",
    "강원FC": "Gangwon FC",
    "광주FC": "Gwangju FC",
    "서울FC": "FC Seoul",
    "김천상무": "Gimcheon Sangmu",

    # ═══ UCL / Additional ═══
    "아인트라": "Eintracht Frankfurt",
    "벤피카": "Benfica",
    "포르투": "FC Porto",
    "스포르팅": "Sporting CP",
    "갈라타사": "Galatasaray",
    "페네르바": "Fenerbahce",
    "셀틱": "Celtic",
    "레인저스": "Rangers",
    "클뤼브": "Club Brugge",
    "안데를레": "Anderlecht",
    "브라가": "Braga",
    "잘츠부르": "RB Salzburg",
    "샤흐타르": "Shakhtar Donetsk",
    "티나모자": "Dinamo Zagreb",
    "올림피아": "Olympiacos",

    # ═══ NBA ═══
    "올랜매직": "Orlando Magic",
    "밀워벅스": "Milwaukee Bucks",
    "LA레이커": "Los Angeles Lakers",
    "골든스워": "Golden State Warriors",
    "보스셀틱": "Boston Celtics",
    "마이히트": "Miami Heat",
    "댈매브릭": "Dallas Mavericks",
    "피닉스선": "Phoenix Suns",
    "시카불스": "Chicago Bulls",
    "필76인즈": "Philadelphia 76ers",
    "뉴욕닉스": "New York Knicks",
    "브루넷츠": "Brooklyn Nets",
    "덴너기츠": "Denver Nuggets",
    "미네울버": "Minnesota Timberwolves",
    "클리캐벌": "Cleveland Cavaliers",
    "인디페이": "Indiana Pacers",
    "새크킹즈": "Sacramento Kings",
    "샤토셀스": "Charlotte Hornets",
    "디워피즈": "Detroit Pistons",
    "뉴올펠리": "New Orleans Pelicans",
    "샌안스퍼": "San Antonio Spurs",
    "멤그리즈": "Memphis Grizzlies",
    "포트블레": "Portland Trail Blazers",
    "유타재즈": "Utah Jazz",
    "토론래프": "Toronto Raptors",
    "워싱위저": "Washington Wizards",
    "오클시티": "Oklahoma City Thunder",
    "LA클리퍼": "LA Clippers",
    "휴스로킷": "Houston Rockets",
    "애틀호크": "Atlanta Hawks",

    # ═══ MLS ═══
    "LAG": "LA Galaxy",
    "LAFC": "LAFC",
    "인터마이": "Inter Miami CF",
    "뉴욕시FC": "New York City FC",
    "뉴욕RB": "Red Bull New York",
    "포틀랜드": "Portland Timbers",
    "애틀유나": "Atlanta United FC",
    "토론토FC": "Toronto FC",
    "내쉬빌SC": "Nashville SC",

    # ═══ MLB ═══
    "필라델피": "Philadelphia Phillies",
    "마이애미": "Miami Marlins",
    "워싱턴": "Washington Nationals",
    "캔자스시": "Kansas City Royals",
    "신시내티": "Cincinnati Reds",
    "뉴욕메츠": "New York Mets",
    "세인트루": "St. Louis Cardinals",
    "샌디에이": "San Diego Padres",
    "LA다저스": "Los Angeles Dodgers",
    "샌프란시": "San Francisco Giants",
    "애리조나": "Arizona Diamondbacks",
    "콜로라도": "Colorado Rockies",
    "애틀랜타": "Atlanta Braves",
    "뉴욕양키": "New York Yankees",
    "보스턴": "Boston Red Sox",
    "탬파베이": "Tampa Bay Rays",
    "볼티모어": "Baltimore Orioles",
    "토론토": "Toronto Blue Jays",
    "시카고C": "Chicago Cubs",
    "시카고W": "Chicago White Sox",
    "클리블레": "Cleveland Guardians",
    "디트로이": "Detroit Tigers",
    "미네소타": "Minnesota Twins",
    "휴스턴": "Houston Astros",
    "오클랜드": "Athletics",
    "시애틀": "Seattle Mariners",
    "텍사스": "Texas Rangers",
    "LA에인절": "Los Angeles Angels",
    "밀워키": "Milwaukee Brewers",
    "피츠버그": "Pittsburgh Pirates",
}

# Build Betman abbreviation → Full Korean name map
BETMAN_ABBR_TO_FULL_KO: Dict[str, str] = {}
for _abbr, _en in TEAM_MAP_KR_TO_EN.items():
    if _en in TEAM_DISPLAY_EN_TO_KO:
        BETMAN_ABBR_TO_FULL_KO[_abbr] = TEAM_DISPLAY_EN_TO_KO[_en]

# Reverse lookup for backward-compat imports
TEAM_MAP_EN_TO_KR: Dict[str, str] = dict(TEAM_DISPLAY_EN_TO_KO)


class TeamMapper:
    """
    Bidirectional team name mapper:
    - get_korean_name(english_name) -> Full Standard Korean Name (e.g. 'Borussia Dortmund' -> '도르트문트')
    - get_english_name(korean_name) -> Full English Name
    - match_team_pair(...) -> Betman vs Pinnacle/ESPN match comparator
    """

    def __init__(self):
        self.kr_to_en = dict(TEAM_MAP_KR_TO_EN)
        # Also register full Korean names -> English names
        for en, ko in TEAM_DISPLAY_EN_TO_KO.items():
            if ko not in self.kr_to_en:
                self.kr_to_en[ko] = en
        self.en_to_kr = dict(TEAM_DISPLAY_EN_TO_KO)
        self._kr_norm_cache: Dict[str, str] = {}
        self._en_norm_cache: Dict[str, str] = {}
        self._build_caches()

    def _build_caches(self):
        """Build normalized lookup caches for fast, accent-insensitive matching."""
        for kr, en in self.kr_to_en.items():
            self._kr_norm_cache[self._normalize(kr)] = en
        for en, kr in self.en_to_kr.items():
            self._en_norm_cache[self._normalize(en)] = kr

    @staticmethod
    def _strip_accents(text: str) -> str:
        """Strip diacritics (é->e, ö->o, ã->a, ø->o, etc.)."""
        text = text.replace("ø", "o").replace("Ø", "O").replace("&", "and")
        return "".join(
            ch for ch in unicodedata.normalize("NFKD", text)
            if not unicodedata.combining(ch)
        )

    @classmethod
    def _normalize(cls, name: str) -> str:
        """Normalize: strip accents, lowercase, remove club affixes/punctuation."""
        if not name:
            return ""
        n = cls._strip_accents(name.strip()).lower()
        n = re.sub(r"\b(fc|sc|cf|afc|ssc|acf|us|ss|vfl|vfb|spvgg|rcd|ud|cd|ca|ac|as|rc|aj|ogc|nec|pec|nac|fk|sk|nk)\b", "", n)
        n = re.sub(r"[^a-z0-9\uac00-\ud7a3]", "", n)
        return n

    def get_english_name(self, korean_name: str) -> Optional[str]:
        """Korean name (Betman abbreviation or full Korean) → English full name."""
        if not korean_name:
            return None
        if korean_name in self.kr_to_en:
            return self.kr_to_en[korean_name]

        norm = self._normalize(korean_name)
        if norm in self._kr_norm_cache:
            return self._kr_norm_cache[norm]

        for kr_key in self.kr_to_en:
            if len(korean_name) >= 2 and (kr_key.startswith(korean_name) or korean_name.startswith(kr_key)):
                return self.kr_to_en[kr_key]

        return None

    def get_korean_name(self, english_name: str) -> Optional[str]:
        """English full name → Standard Full Korean name."""
        if not english_name:
            return None
        clean = english_name.strip()

        # 0. If already a Betman 4-char abbreviation, upgrade to full Korean name
        if clean in BETMAN_ABBR_TO_FULL_KO:
            return BETMAN_ABBR_TO_FULL_KO[clean]

        # 1. Exact match
        if clean in self.en_to_kr:
            return self.en_to_kr[clean]

        # 2. Case-insensitive / accent-stripped exact match
        clean_ascii = self._strip_accents(clean).lower()
        for en_key, kr_val in self.en_to_kr.items():
            if self._strip_accents(en_key).lower() == clean_ascii:
                return kr_val

        # 3. Normalized club-name match (strips FC/SC/CF/etc.)
        norm = self._normalize(clean)
        if norm and norm in self._en_norm_cache:
            return self._en_norm_cache[norm]

        return None

    def match_team_pair(
        self,
        kr_home: str,
        kr_away: str,
        en_home: str,
        en_away: str,
    ) -> bool:
        """Check if a Betman (KR) match == a Pinnacle/ESPN (EN) match."""
        en_h = self.get_english_name(kr_home)
        en_a = self.get_english_name(kr_away)

        if en_h and en_a:
            if self._normalize(en_h) == self._normalize(en_home) and self._normalize(en_a) == self._normalize(en_away):
                return True

        kr_h = self.get_korean_name(en_home)
        kr_a = self.get_korean_name(en_away)
        if kr_h and kr_a:
            full_kr_home = BETMAN_ABBR_TO_FULL_KO.get(kr_home, kr_home)
            full_kr_away = BETMAN_ABBR_TO_FULL_KO.get(kr_away, kr_away)
            if (kr_h == full_kr_home or full_kr_home in kr_h or kr_h in full_kr_home) and (
                kr_a == full_kr_away or full_kr_away in kr_a or kr_a in full_kr_away
            ):
                return True

        return False

    def add_mapping(self, korean_name: str, english_name: str):
        """Add a new mapping dynamically."""
        self.kr_to_en[korean_name] = english_name
        self.en_to_kr[english_name] = korean_name
        self._kr_norm_cache[self._normalize(korean_name)] = english_name
        self._en_norm_cache[self._normalize(english_name)] = korean_name

    def get_stats(self) -> dict:
        """Return mapping statistics."""
        return {
            "total_mappings": len(self.en_to_kr),
            "kr_keys": len(self._kr_norm_cache),
            "en_keys": len(self._en_norm_cache),
        }
