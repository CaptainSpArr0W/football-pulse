"""抓取五大联赛每场 xG（Understat，经 soccerdata）并输出 JSON。
用法: python fetch-understat.py [联赛名...]  # 默认全部五大联赛
输出: {league: [{date, home, away, home_xg, away_xg, home_goals, away_goals, home_ppda, away_ppda}, ...]}
"""
import json, sys, soccerdata as sd

LEAGUES = ["ENG-Premier League", "ESP-La Liga", "GER-Bundesliga", "ITA-Serie A", "FRA-Ligue 1"]

def main():
    leagues = sys.argv[1:] or LEAGUES
    out = {}
    for lg in leagues:
        try:
            us = sd.Understat(leagues=lg, seasons=2025)
            df = us.read_team_match_stats()
            rows = []
            for _, r in df.iterrows():
                rows.append({
                    "date": str(r["date"])[:10],
                    "home": str(r["home_team"]),
                    "away": str(r["away_team"]),
                    "home_xg": round(float(r["home_xg"]), 2),
                    "away_xg": round(float(r["away_xg"]), 2),
                    "home_goals": int(r["home_goals"]),
                    "away_goals": int(r["away_goals"]),
                    "home_ppda": round(float(r["home_ppda"]), 2) if r["home_ppda"] == r["home_ppda"] else None,
                    "away_ppda": round(float(r["away_ppda"]), 2) if r["away_ppda"] == r["away_ppda"] else None,
                })
            out[lg] = rows
            print(f"{lg}: {len(rows)} 场", flush=True)
        except Exception as e:
            print(f"{lg} 失败: {type(e).__name__} {str(e)[:150]}", flush=True)
    path = r"C:\Users\JackSparrow\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\work-mode-projects\6a79697b30e5247aa53a9908\football-pulse\server\data\understat-xg.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print("已保存:", path)

if __name__ == "__main__":
    main()
