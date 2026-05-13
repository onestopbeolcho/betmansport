import customtkinter as ctk
import threading
import time
import datetime

# UI 테마 설정
ctk.set_appearance_mode("Dark")  # Dark, Light, System
ctk.set_default_color_theme("blue")  # Themes: blue, dark-blue, green

class ScorenixManagerApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Scorenix Auto-Manager v1.0")
        self.geometry("900x600")
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # 상태 변수
        self.is_running = False
        self.is_listener_on = False

        self._build_sidebar()
        self._build_main_frame()
        
        self.log_message("✅ Scorenix Auto-Manager 시스템 초기화 완료.")

    def _build_sidebar(self):
        # 사이드바 프레임
        self.sidebar_frame = ctk.CTkFrame(self, width=200, corner_radius=0)
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew")
        self.sidebar_frame.grid_rowconfigure(5, weight=1)

        # 로고 타이틀
        self.logo_label = ctk.CTkLabel(self.sidebar_frame, text="SCORENIX\nMANAGER", font=ctk.CTkFont(size=24, weight="bold"))
        self.logo_label.grid(row=0, column=0, padx=20, pady=(20, 30))

        # 개별 작업 버튼들
        self.btn_crawl = ctk.CTkButton(self.sidebar_frame, text="1. 배당 및 스탯 크롤링", command=lambda: self.run_task("crawling"))
        self.btn_crawl.grid(row=1, column=0, padx=20, pady=10)

        self.btn_ai = ctk.CTkButton(self.sidebar_frame, text="2. AI 팩터 분석 생성", command=lambda: self.run_task("ai"))
        self.btn_ai.grid(row=2, column=0, padx=20, pady=10)

        self.btn_video = ctk.CTkButton(self.sidebar_frame, text="3. 쇼츠 영상 렌더링", command=lambda: self.run_task("video"))
        self.btn_video.grid(row=3, column=0, padx=20, pady=10)

        self.btn_upload = ctk.CTkButton(self.sidebar_frame, text="4. 유튜브 업로드", command=lambda: self.run_task("upload"))
        self.btn_upload.grid(row=4, column=0, padx=20, pady=10)

        # 웹 연동 리스너 스위치 (하단 배치)
        self.switch_listener = ctk.CTkSwitch(self.sidebar_frame, text="🌐 웹 연동 대기 모드", command=self.toggle_listener)
        self.switch_listener.grid(row=6, column=0, padx=20, pady=(10, 20))

    def _build_main_frame(self):
        # 메인 프레임
        self.main_frame = ctk.CTkFrame(self, corner_radius=10)
        self.main_frame.grid(row=0, column=1, padx=20, pady=20, sticky="nsew")
        self.main_frame.grid_rowconfigure(2, weight=1)
        self.main_frame.grid_columnconfigure(0, weight=1)

        # 상단 타이틀
        self.title_label = ctk.CTkLabel(self.main_frame, text="대시보드 및 원클릭 자동화", font=ctk.CTkFont(size=20, weight="bold"))
        self.title_label.grid(row=0, column=0, padx=20, pady=(20, 10), sticky="w")

        # 원클릭 자동화 버튼
        self.btn_auto_all = ctk.CTkButton(
            self.main_frame, 
            text="🚀 전체 자동화 원클릭 실행 (크롤링 ~ 업로드)", 
            font=ctk.CTkFont(size=16, weight="bold"),
            fg_color="#0E2954",
            hover_color="#1a458a",
            height=50,
            command=self.run_auto_all
        )
        self.btn_auto_all.grid(row=1, column=0, padx=20, pady=10, sticky="ew")

        # 프로그레스 바
        self.progress_bar = ctk.CTkProgressBar(self.main_frame)
        self.progress_bar.grid(row=2, column=0, padx=20, pady=10, sticky="ew")
        self.progress_bar.set(0)

        # 로그 출력 텍스트 박스
        self.log_box = ctk.CTkTextbox(self.main_frame, font=ctk.CTkFont(family="Consolas", size=13))
        self.log_box.grid(row=3, column=0, padx=20, pady=(10, 20), sticky="nsew")

    def log_message(self, message):
        """로그 박스에 메시지 출력 (타임스탬프 포함)"""
        timestamp = datetime.datetime.now().strftime("[%H:%M:%S]")
        self.log_box.insert("end", f"{timestamp} {message}\n")
        self.log_box.see("end")

    def toggle_listener(self):
        """웹 연동 대기 모드 토글"""
        self.is_listener_on = self.switch_listener.get()
        if self.is_listener_on:
            self.log_message("🌐 원격 웹 연동 모드가 [켜짐] 상태로 변경되었습니다. (Firestore 대기 중...)")
            threading.Thread(target=self._firebase_listener_worker, daemon=True).start()
        else:
            self.log_message("🌐 원격 웹 연동 모드가 [꺼짐] 상태로 변경되었습니다.")

    def _firebase_listener_worker(self):
        """백그라운드에서 Firestore를 모니터링하며 원격 명령을 감지하는 스레드"""
        try:
            import sys
            import os
            # 백엔드 모듈 임포트를 위해 경로 추가
            sys.path.append(os.path.abspath(os.path.dirname(__file__)))
            
            from app.db.firestore import get_firestore_db
            from firebase_admin import firestore
            
            # 기존 인증 로직 재사용
            db = get_firestore_db()
            doc_ref = db.collection("system_control").document("remote_trigger")
            
            self.log_message("📡 Firebase 연결 완료. 명령 대기 중...")
            
            while self.is_listener_on:
                doc = doc_ref.get()
                if doc.exists:
                    data = doc.to_dict()
                    # 'trigger_auto_all' 필드가 True일 경우 자동화 실행
                    if data.get("trigger_auto_all") is True:
                        self.log_message("🔥 [웹 원격 명령 수신] 관리자 페이지에서 자동화 요청이 들어왔습니다!")
                        
                        # 플래그 초기화 (중복 실행 방지)
                        doc_ref.update({
                            "trigger_auto_all": False,
                            "last_executed": firestore.SERVER_TIMESTAMP,
                            "status": "running"
                        })
                        
                        # 자동화 파이프라인 실행
                        self.run_auto_all()
                        
                        # 작업이 끝날 때까지 대기
                        while self.is_running:
                            time.sleep(2)
                            
                        # 상태 업데이트
                        doc_ref.update({"status": "completed"})
                
                # 10초마다 폴링 (서버 부하 방지 및 UI 멈춤 방지)
                time.sleep(10)
                
        except Exception as e:
            if self.is_listener_on:
                self.log_message(f"❌ 원격 연동 중 오류 발생: {e}")
            self.switch_listener.deselect()
            self.is_listener_on = False

    def run_task(self, task_name):
        """개별 작업 실행 (UI가 멈추지 않도록 스레드 사용)"""
        if self.is_running:
            self.log_message("⚠️ 현재 다른 작업이 실행 중입니다. 잠시 후 시도해주세요.")
            return
        
        threading.Thread(target=self._mock_task_worker, args=(task_name,), daemon=True).start()

    def run_auto_all(self):
        """전체 자동화 원클릭 실행"""
        if self.is_running:
            self.log_message("⚠️ 현재 다른 작업이 실행 중입니다.")
            return
        
        threading.Thread(target=self._mock_auto_all_worker, daemon=True).start()

    def _run_script(self, script_name, description):
        """실제 파이썬 스크립트를 하위 프로세스로 실행하고 로그를 캡처하는 함수"""
        import subprocess
        import sys
        
        self.log_message(f"▶️ [{description}] 작업을 시작합니다... (실행 중: {script_name})")
        try:
            # 파이썬 스크립트 실행 (stdout, stderr 캡처)
            process = subprocess.Popen(
                [sys.executable, script_name],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace'
            )
            
            # 실시간 로그 출력
            for line in iter(process.stdout.readline, ''):
                if line:
                    self.log_message(f"  {line.strip()}")
                    
            process.stdout.close()
            return_code = process.wait()
            
            if return_code == 0:
                self.log_message(f"✅ [{description}] 작업이 성공적으로 완료되었습니다.")
                return True
            else:
                self.log_message(f"❌ [{description}] 작업 중 오류가 발생했습니다. (종료 코드: {return_code})")
                return False
                
        except Exception as e:
            self.log_message(f"❌ 실행 오류: {e}")
            return False

    def _mock_task_worker(self, task_name):
        self.is_running = True
        self.progress_bar.set(0)
        self.progress_bar.start()
        
        if task_name == "crawling":
            self._run_script("sync_betman_to_cloud.py", "국내 배당 크롤링 및 동기화")
        elif task_name == "ai":
            # AI 생성 스크립트가 별도로 있다면 여기에 추가 (예: check_preds.py)
            self._run_script("check_preds.py", "AI 예측 확인")
        elif task_name == "video":
            self._run_script("generate_shorts_pipeline.py", "쇼츠 영상 자동 렌더링")
        elif task_name == "upload":
            # 유튜브 업로더 스크립트 실행
            import os
            if os.path.exists("app/services/youtube_uploader.py"):
                self._run_script("app/services/youtube_uploader.py", "유튜브 쇼츠 업로드")
            else:
                self.log_message("⚠️ 유튜브 업로드 스크립트를 찾을 수 없습니다.")

        self.progress_bar.stop()
        self.progress_bar.set(1)
        self.is_running = False

    def _mock_auto_all_worker(self):
        self.is_running = True
        self.progress_bar.set(0)
        
        self.log_message("🚀 [전체 자동화] 원클릭 파이프라인을 시작합니다.")
        
        tasks = [
            ("sync_betman_to_cloud.py", "1. 배당 크롤링"),
            ("check_preds.py", "2. AI 팩터 스코어 확인"),
            ("generate_shorts_pipeline.py", "3. 쇼츠 렌더링"),
            ("app/services/youtube_uploader.py", "4. 유튜브 업로드")
        ]
        
        total_tasks = len(tasks)
        
        for i, (script, desc) in enumerate(tasks):
            import os
            if os.path.exists(script):
                success = self._run_script(script, desc)
                if not success:
                    self.log_message(f"🛑 [{desc}] 단계에서 중단되었습니다.")
                    break
            else:
                self.log_message(f"⚠️ 스크립트 누락: {script} (건너뜀)")
            
            self.progress_bar.set((i + 1) / total_tasks)

        self.log_message("🎉 모든 자동화 파이프라인이 종료되었습니다.")
        self.is_running = False

if __name__ == "__main__":
    app = ScorenixManagerApp()
    app.mainloop()
