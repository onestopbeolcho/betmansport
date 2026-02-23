"""
Betman (Korean) ↔ English team name mapper.
Covers all major leagues tracked by Betman & The Odds API.

Betman uses 3-4 character Korean abbreviations.
The Odds API uses full English names.

Matching strategy:
  1. Exact KR → EN lookup
  2. Prefix matching (Betman truncates long names)
  3. Reverse EN → KR lookup
"""
from typing import Dict, Optional, Tuple
import re


# ─────────────────────────────────────────────
# Korean abbreviation → Full English name
# ─────────────────────────────────────────────

TEAM_MAP_KR_TO_EN: Dict[str, str] = {
    # ═══ EPL (English Premier League) ═══
    "맨시티": "Manchester City",
    "리버풀": "Liverpool",
    "아스널": "Arsenal",
    "첼시": "Chelsea",
    "토트넘": "Tottenham Hotspur",
    "맨유": "Manchester United",
    "뉴캐슬U": "Newcastle United",
    "A빌라": "Aston Villa",
    "브라이턴": "Brighton and Hove Albion",
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
    "AT마드": "Atletico Madrid",
    "소시에다": "Real Sociedad",
    "비야레알": "Villarreal CF",
    "베티스": "Real Betis",
    "세비야": "Sevilla FC",
    "발렌시아": "Valencia CF",
    "셀타비고": "Celta Vigo",
    "RC셀타": "Celta Vigo",
    "에스파뇰": "Espanyol",
    "마요르카": "RCD Mallorca",
    "라요": "Rayo Vallecano",
    "오사수나": "CA Osasuna",
    "알라베스": "Deportivo Alaves",
    "카디스": "Cadiz CF",
    "그라나다": "Granada CF",
    "알메리아": "UD Almeria",
    "라스팔마": "Las Palmas",
    "헤타페": "Getafe CF",
    "오비에도": "Real Oviedo",
    "레반테": "Levante UD",
    "발라돌리": "Real Valladolid",
    "빌바오": "Athletic Bilbao",
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
    "묀헨글라": "Borussia Monchengladbach",
    "호펜하임": "TSG Hoffenheim",
    "브레멘": "Werder Bremen",
    "아우크스": "FC Augsburg",
    "하이덴하": "1. FC Heidenheim",
    "U베를린": "Union Berlin",
    "보훔": "VfL Bochum",
    "다름슈타": "SV Darmstadt 98",
    "쾰른": "FC Koln",
    "마인츠": "1. FSV Mainz 05",
    "장크트파": "FC St. Pauli",
    "함부르크": "Hamburger SV",
    "뉘른베르": "1. FC Nurnberg",
    "헤르타": "Hertha BSC",
    "카이저스": "1. FC Kaiserslautern",
    "킬FK": "Holstein Kiel",
    "그로이터": "SpVgg Greuther Furth",
    "쾰른": "FC Koln",

    # ═══ Serie A ═══
    "인테르": "Inter Milan",
    "유벤투스": "Juventus",
    "나폴리": "SSC Napoli",
    "AC밀란": "AC Milan",
    "AS로마": "AS Roma",
    "라치오": "SS Lazio",
    "아탈란타": "Atalanta BC",
    "피오렌티": "ACF Fiorentina",
    "볼로냐": "Bologna FC",
    "토리노": "Torino FC",
    "우디네세": "Udinese",
    "사수올로": "US Sassuolo",
    "제노아": "Genoa CFC",
    "칼리아리": "Cagliari",
    "엠폴리": "Empoli FC",
    "살레르니": "Salernitana",
    "프로시노": "Frosinone",
    "레체": "US Lecce",
    "베로나": "Hellas Verona",
    "몬차": "AC Monza",
    "코모1907": "Como 1907",
    "파르마": "Parma Calcio 1913",
    "베네치아": "Venezia FC",
    "크레모네": "US Cremonese",
    "엘라스": "Hellas Verona",

    # ═══ Ligue 1 ═══
    "파리SG": "Paris Saint-Germain",
    "PSG": "Paris Saint-Germain",
    "마르세유": "Olympique Marseille",
    "리옹": "Olympique Lyonnais",
    "릴OSC": "Lille OSC",
    "모나코": "AS Monaco",
    "랑스": "Stade de Reims",
    "OGC니스": "OGC Nice",
    "RC스트라": "RC Strasbourg",
    "렌": "Stade Rennais",
    "낭트": "FC Nantes",
    "몽펠리에": "Montpellier HSC",
    "툴루즈": "Toulouse FC",
    "르아브르": "Le Havre AC",
    "브레스투": "Stade Brestois 29",
    "로리앙": "FC Lorient",
    "메스": "FC Metz",
    "클레르몽": "Clermont Foot",
    "오세르": "AJ Auxerre",
    "앙제SCO": "Angers SCO",
    "파리FC": "Paris FC",
    "앙제": "Angers SCO",
    "생테티엔": "AS Saint-Etienne",

    # ═══ Eredivisie ═══
    "아약스": "Ajax",
    "PSV": "PSV Eindhoven",
    "페예노르": "Feyenoord",
    "알크마르": "AZ Alkmaar",
    "트벤테": "FC Twente",
    "위트레흐": "FC Utrecht",
    "흐로닝언": "FC Groningen",
    "헤이렌베": "SC Heerenveen",
    "즈볼러": "PEC Zwolle",
    "엑셀시오": "Excelsior",
    "스파로테": "Sparta Rotterdam",
    "고어헤드": "Go Ahead Eagles",
    "네이메헌": "NEC Nijmegen",
    "브레다": "NAC Breda",
    "텔스타": "SC Telstar",
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
    "번리": "Burnley",
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

    # ═══ J-League ═══
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
    "제프유나": "JEF United Chiba",

    # ═══ UCL / Additional ═══
    "아인트라": "Eintracht Frankfurt",
    "벤피카": "SL Benfica",
    "포르투": "FC Porto",
    "스포르팅": "Sporting CP",
    "갈라타사": "Galatasaray",
    "페네르바": "Fenerbahce",
    "셀틱": "Celtic",
    "레인저스": "Rangers",
    "클뤼브": "Club Brugge",
    "안데를레": "Anderlecht",
    "브라가": "SC Braga",
    "잘츠부르": "Red Bull Salzburg",
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
    "LA클리퍼": "Los Angeles Clippers",
    "휴스로킷": "Houston Rockets",
    "애틀호크": "Atlanta Hawks",
}

# ─────────────────────────────────────────────
# Build reverse index (English → Korean)
# ─────────────────────────────────────────────

TEAM_MAP_EN_TO_KR: Dict[str, str] = {v: k for k, v in TEAM_MAP_KR_TO_EN.items()}


class TeamMapper:
    """
    Bidirectional team name mapper with fuzzy prefix matching.
    
    Betman uses truncated Korean names (3-4 chars).
    The Odds API uses full English names.
    """

    def __init__(self):
        self.kr_to_en = dict(TEAM_MAP_KR_TO_EN)
        self.en_to_kr = dict(TEAM_MAP_EN_TO_KR)
        # Normalized lookup caches
        self._kr_norm_cache: Dict[str, str] = {}
        self._en_norm_cache: Dict[str, str] = {}
        self._build_caches()

    def _build_caches(self):
        """Build normalized lookup caches for faster matching."""
        for kr, en in self.kr_to_en.items():
            self._kr_norm_cache[self._normalize(kr)] = en
        for en, kr in self.en_to_kr.items():
            self._en_norm_cache[self._normalize(en)] = kr

    @staticmethod
    def _normalize(name: str) -> str:
        """Normalize: lowercase, strip spaces, remove FC/SC/CF etc."""
        n = name.strip().lower()
        n = re.sub(r'\b(fc|sc|cf|afc|ssc|acf|us|ss|vfl|vfb|spvgg)\b', '', n)
        n = n.replace(" ", "").replace(".", "").replace("-", "")
        return n

    def get_english_name(self, korean_name: str) -> Optional[str]:
        """Korean abbreviation → English full name."""
        # 1. Exact match
        if korean_name in self.kr_to_en:
            return self.kr_to_en[korean_name]

        # 2. Normalized exact match
        norm = self._normalize(korean_name)
        if norm in self._kr_norm_cache:
            return self._kr_norm_cache[norm]

        # 3. Prefix match (Betman truncates names)
        for kr_key in self.kr_to_en:
            if kr_key.startswith(korean_name) or korean_name.startswith(kr_key):
                return self.kr_to_en[kr_key]

        return None

    def get_korean_name(self, english_name: str) -> Optional[str]:
        """English full name → Korean abbreviation."""
        # 1. Exact match
        if english_name in self.en_to_kr:
            return self.en_to_kr[english_name]

        # 2. Normalized match
        norm = self._normalize(english_name)
        if norm in self._en_norm_cache:
            return self._en_norm_cache[norm]

        # 3. Case-insensitive
        name_lower = english_name.lower()
        for en_key, kr_val in self.en_to_kr.items():
            if en_key.lower() == name_lower:
                return kr_val

        # 4. Substring match
        for en_key, kr_val in self.en_to_kr.items():
            en_norm = self._normalize(en_key)
            if norm in en_norm or en_norm in norm:
                return kr_val

        return None

    def match_team_pair(
        self, 
        kr_home: str, 
        kr_away: str, 
        en_home: str, 
        en_away: str
    ) -> bool:
        """
        Check if a Betman (KR) match == a Pinnacle (EN) match.
        Uses bidirectional lookup + fuzzy prefix.
        """
        # Strategy 1: KR → EN, compare with Pinnacle EN names
        en_h = self.get_english_name(kr_home)
        en_a = self.get_english_name(kr_away)

        if en_h and en_a:
            en_h_norm = self._normalize(en_h)
            en_a_norm = self._normalize(en_a)
            pin_h_norm = self._normalize(en_home)
            pin_a_norm = self._normalize(en_away)
            if en_h_norm == pin_h_norm and en_a_norm == pin_a_norm:
                return True

        # Strategy 2: EN → KR, compare with Betman KR names
        kr_h = self.get_korean_name(en_home)
        kr_a = self.get_korean_name(en_away)

        if kr_h and kr_a:
            if (kr_h == kr_home or kr_home.startswith(kr_h) or kr_h.startswith(kr_home)):
                if (kr_a == kr_away or kr_away.startswith(kr_a) or kr_a.startswith(kr_away)):
                    return True

        # Strategy 3: Fuzzy substring on normalized English names
        if en_h and en_a:
            pin_h_norm = self._normalize(en_home)
            pin_a_norm = self._normalize(en_away)
            en_h_norm = self._normalize(en_h)
            en_a_norm = self._normalize(en_a)
            if (en_h_norm in pin_h_norm or pin_h_norm in en_h_norm):
                if (en_a_norm in pin_a_norm or pin_a_norm in en_a_norm):
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
            "total_mappings": len(self.kr_to_en),
            "kr_keys": len(self._kr_norm_cache),
            "en_keys": len(self._en_norm_cache),
        }
