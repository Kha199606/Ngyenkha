import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// Đảm bảo jQuery và ionRangeSlider đã được load trước khi file này được thực thi
// Ví dụ: <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
//        <script src="https://cdnjs.cloudflare.com/ajax/libs/ion-rangeslider/2.3.1/js/ion.rangeSlider.min.js"></script>
//        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/ion-rangeslider/2.3.1/css/ion.rangeSlider.min.css"/>

/**
 * Class quản lý timeline và điều khiển animation cho Three.js
 */
export class Timeline {
    /**
     * Khởi tạo Timeline.
     * @param {object} options - Các tùy chọn cấu hình.
     * @param {THREE.AnimationMixer} options.mixer - Instance AnimationMixer của Three.js.
     * @param {THREE.AnimationAction[]} options.actions - Mảng các AnimationAction.
     * @param {string} options.timelineElementId - ID của container div cho timeline.
     * @param {string} options.pauseResumeButtonId - ID của nút Pause/Resume.
     * @param {string} options.rangeSliderInputId - ID của input cho range slider (chọn khoảng).
     * @param {string} options.progressSliderInputId - ID của input cho progress slider (thanh chạy).
     * @param {THREE.Clock} [options.clock] - Optional: Clock của Three.js. Nếu không cung cấp, sẽ tạo mới.
     */
    constructor(options) {
        if (!options.mixer || !options.actions || options.actions.length === 0 ||
            !options.timelineElementId || !options.pauseResumeButtonId ||
            !options.rangeSliderInputId || !options.progressSliderInputId) {
            console.error("Timeline requires mixer, actions, and element IDs.");
            return;
        }
        if (typeof $ === 'undefined' || !$.fn.ionRangeSlider) {
            console.error("Timeline requires jQuery and ionRangeSlider to be loaded.");
            return;
        }

        this.mixer = options.mixer;
        this.actions = options.actions;
        this.clock = options.clock || new THREE.Clock(); // Use provided clock or create a new one

        // DOM Elements
        this.timelineElement = document.getElementById(options.timelineElementId);
        this.pauseResumeButton = document.getElementById(options.pauseResumeButtonId);
        this.rangeSliderInputElement = document.getElementById(options.rangeSliderInputId);
        this.progressSliderInputElement = document.getElementById(options.progressSliderInputId);

        if (!this.timelineElement || !this.pauseResumeButton || !this.rangeSliderInputElement || !this.progressSliderInputElement) {
            console.error("One or more Timeline DOM elements not found.");
            return;
        }

        // State
        this.longestAction = null;
        this.longestDuration = 0;
        this.rangeSliderInstance = null;
        this.progressSliderInstance = null;
        this.isDraggingSlider = false;
        this.isPaused = false; // Internal pause state for UI
        this._wasPausedBeforeDrag = false; // Helper for drag state


        this.init();
    }

    /**
     * Khởi tạo các thành phần của timeline.
     * @private
     */
    init() {
        this._findLongestAction();
        if (!this.longestAction) return;

        this.timelineElement.style.display = 'block'; // Show the timeline

        // Set initial state for actions (play them, set timescale)
        this.actions.forEach(action => {
            action.play();
            action.timeScale = 1; // Ensure playing initially
        });
        this.isPaused = false; // Start in playing state

        this._setupSliders();
        this._attachEventListeners();
        this.updatePlayPauseButton(); // Update button to initial state (playing)
    }

    /**
     * Tìm action dài nhất và lấy duration.
     * @private
     */
    _findLongestAction() {
        if (this.actions.length === 0) return;
        this.longestAction = this.actions.reduce((a, b) => (a.getClip().duration > b.getClip().duration ? a : b));
        this.longestDuration = this.longestAction.getClip().duration;
        // Đặt loop cho tất cả action dựa trên action dài nhất (hoặc xử lý khác nếu cần)
        // this.actions.forEach(action => {
        //     action.setLoop(THREE.LoopRepeat); // Ví dụ: lặp lại vô hạn
        //     action.clampWhenFinished = true; // Giữ ở frame cuối nếu không loop
        // });
        console.log("Longest duration:", this.longestDuration);
    }

    /**
     * Cài đặt ionRangeSlider cho range và progress.
     * @private
     */
    _setupSliders() {
        // Range Slider (Optional - currently not used for control)
        $(this.rangeSliderInputElement).ionRangeSlider({
            skin: "flat", type: "double", min: 0, max: this.longestDuration,
            from: 0, to: this.longestDuration, step: 0.01, grid: true,
            grid_num: 10, prettify: this._prettifyNumber,
            // onchange/onfinish có thể thêm nếu cần điều chỉnh vùng animation
        });
        this.rangeSliderInstance = $(this.rangeSliderInputElement).data("ionRangeSlider");

        // Progress Slider
        $(this.progressSliderInputElement).ionRangeSlider({
            skin: "flat", type: "single", min: 0, max: this.longestDuration,
            from: 0, step: 0.01, grid: false, prettify: this._prettifyNumber,
            hide_min_max: true, hide_from_to: false,
            onStart: () => { // Arrow function để giữ 'this' context
                this.isDraggingSlider = true;
                this._wasPausedBeforeDrag = this.isPaused; // Lưu trạng thái trước khi kéo
                if (!this.isPaused) {
                    this.actions.forEach(action => action.timeScale = 0); // Tạm dừng animation khi kéo
                }
            },
            onChange: (data) => { // Arrow function
                const targetTime = data.from;
                this.setTime(targetTime); // Cập nhật thời gian animation
            },
            onFinish: () => { // Arrow function
                this.isDraggingSlider = false;
                 // Khôi phục trạng thái play/pause trước khi kéo
                if (!this._wasPausedBeforeDrag) {
                    this.actions.forEach(action => action.timeScale = 1); // Tiếp tục nếu trước đó đang chạy
                    this.clock.getDelta(); // Reset delta sau khi nhảy thời gian/pause
                }
                // Không cần set this.isPaused ở đây, nó được giữ nguyên qua _wasPausedBeforeDrag
            }
        });
        this.progressSliderInstance = $(this.progressSliderInputElement).data("ionRangeSlider");
    }

    /**
     * Gắn các event listener cần thiết.
     * @private
     */
    _attachEventListeners() {
        this.pauseResumeButton.onclick = this.togglePlayPause.bind(this); // Bind 'this'
         // Handle window resize to update sliders
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    /**
     * Định dạng số cho đẹp (ví dụ: làm tròn).
     * @param {number} num - Số cần định dạng.
     * @returns {string} - Chuỗi đã định dạng.
     * @private
     */
    _prettifyNumber(num) {
        return num.toFixed(2); // Hiện 2 chữ số thập phân cho mượt hơn
    }

    /**
     * Chuyển đổi trạng thái Play/Pause.
     */
    togglePlayPause() {
        if (this.isDraggingSlider || this.actions.length === 0) return;

        this.isPaused = !this.isPaused;
        const timeScale = this.isPaused ? 0 : 1;

        if (!this.isPaused) {
            // Đồng bộ action về vị trí slider trước khi resume
            const targetTime = this.progressSliderInstance.result.from;
            this.setTime(targetTime);
            this.clock.getDelta(); // Reset delta sau khi pause/nhảy thời gian

            // Đảm bảo action đang chạy khi resume (timeScale=0 có thể đã dừng chúng)
             this.actions.forEach(action => {
                if (!action.isRunning()) {
                    action.reset().play(); // Reset và play lại để đảm bảo
                }
            });
        }

        // Đặt timeScale cho tất cả actions
        this.actions.forEach(action => {
            action.timeScale = timeScale;
        });

        this.updatePlayPauseButton();
    }

    /**
     * Cập nhật giao diện nút Play/Pause.
     */
    updatePlayPauseButton() {
        if (!this.pauseResumeButton) return;
        this.pauseResumeButton.classList.toggle('paused', this.isPaused);
        // Optional: Thay đổi text hoặc icon
        // this.pauseResumeButton.textContent = this.isPaused ? 'Resume' : 'Pause';
    }

    /**
     * Đặt thời gian hiện tại cho tất cả các action.
     * @param {number} time - Thời gian muốn đặt (tính bằng giây).
     */
    setTime(time) {
        if (!this.mixer || this.actions.length === 0) return;
        // Giới hạn thời gian trong khoảng duration hợp lệ
        const clampedTime = Math.max(0, Math.min(time, this.longestDuration));

        // Đặt thời gian cho tất cả action
        this.actions.forEach(action => {
             // Chỉ đặt time nếu action đang được quản lý (có thể có action không dùng)
             if (this.mixer.existingAction(action.getClip())) {
                action.time = clampedTime;
             }
        });

        // Cập nhật mixer ngay lập tức với delta = 0 để hiển thị frame chính xác
        this.mixer.update(0);

        // Cập nhật thanh trượt nếu không phải đang kéo nó
        if (this.progressSliderInstance && !this.isDraggingSlider) {
            this.progressSliderInstance.update({ from: clampedTime });
        }
    }

    /**
     * Hàm cập nhật được gọi trong vòng lặp animation chính (animate loop).
     * @param {number} deltaTime - Thời gian trôi qua từ frame trước.
     */
    update(deltaTime) {
        if (!this.mixer || this.actions.length === 0) return;

        // Mixer *luôn* được cập nhật. Trạng thái pause được quản lý bằng action.timeScale = 0.
        this.mixer.update(deltaTime);

        // Chỉ cập nhật vị trí thanh trượt nếu không đang kéo nó
        if (!this.isDraggingSlider && this.progressSliderInstance && this.longestAction) {
            // Lấy thời gian hiện tại của action dài nhất (modulo duration để xử lý loop)
            const currentTime = this.longestAction.time % this.longestDuration;
            const sliderValue = this.progressSliderInstance.result.from;

            // Chỉ cập nhật slider nếu giá trị thay đổi đủ lớn (tránh rung lắc)
            // Đồng thời đảm bảo không cập nhật nếu animation vừa kết thúc và quay về 0
            // (do modulo) mà slider đang ở cuối.
             const diff = Math.abs(sliderValue - currentTime);
             // Nếu gần bằng duration và slider cũng gần cuối thì không update về 0
             const nearEnd = Math.abs(currentTime - this.longestDuration) < 0.05 || currentTime < 0.05;
             const sliderNearEnd = Math.abs(sliderValue - this.longestDuration) < 0.05;

            if (diff > 0.01 && !(nearEnd && sliderNearEnd && currentTime < sliderValue)) {
                 this.progressSliderInstance.update({ from: currentTime });
            } else if (this.longestAction.paused && Math.abs(sliderValue - this.longestDuration) > 0.01) {
                 // Trường hợp đặc biệt: nếu action đã tự dừng ở cuối (paused=true), cập nhật slider về cuối
                 // This might depend on loop settings (e.g., THREE.LoopOnce)
                 // Check if action actually paused itself at the end
                 if(this.longestAction.time.toFixed(2) >= this.longestDuration.toFixed(2)) {
                    this.progressSliderInstance.update({ from: this.longestDuration });
                 }
            }
        }
    }

     /**
      * Xử lý sự kiện resize cửa sổ.
      */
     onWindowResize() {
         // Cập nhật lại giao diện slider nếu cần (thường ionRangeSlider tự xử lý tốt)
         if (this.rangeSliderInstance) this.rangeSliderInstance.update({});
         if (this.progressSliderInstance) this.progressSliderInstance.update({});
     }


    /**
     * Hủy timeline, gỡ bỏ event listeners và tài nguyên.
     * Nên gọi khi không cần timeline nữa để tránh memory leak.
     */
    destroy() {
        console.log("Destroying timeline...");
        if (this.pauseResumeButton) {
            this.pauseResumeButton.onclick = null; // Gỡ bỏ listener
        }
        window.removeEventListener('resize', this.onWindowResize.bind(this)); // Gỡ bỏ listener

        if (this.rangeSliderInstance) {
            this.rangeSliderInstance.destroy();
            this.rangeSliderInstance = null;
        }
        if (this.progressSliderInstance) {
            this.progressSliderInstance.destroy();
            this.progressSliderInstance = null;
        }

        // Dừng và xóa action khỏi mixer nếu cần
        // this.actions.forEach(action => {
        //     action.stop();
        //     // this.mixer.uncacheAction(action.getClip()); // Cân nhắc nếu cần giải phóng hoàn toàn
        // });
        // this.actions = [];
        // this.mixer = null; // Class này không sở hữu mixer, chỉ tham chiếu

        if (this.timelineElement) {
             this.timelineElement.style.display = 'none'; // Ẩn đi
        }

        console.log("Timeline destroyed.");
    }
}