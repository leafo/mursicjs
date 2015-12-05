// used to control animation outside of react
class SlideToZero {
  constructor(opts={}) {
    this.value = 0;
    this.speed = opts.speed || 100; // 100 pixels a second
    this.animating = false;

    this.onUpdate = opts.onUpdate || function() {}
    this.onStop = opts.onStop || function() {}
    this.onStart = opts.onStart || function() {}
    this.onLoop = opts.onLoop || function() {}

    if (opts.loopPhase) {
      this.looping = true;
      this.loopPhase = opts.loopPhase;
      this.add(this.loopPhase);
    }
  }

  cancel() {
    this.canceled = true
  }

  add(delta) {
    this.value += delta;
    this.checkAndStart();
  }

  checkAndStart() {
    if (this.animating || this.value == 0) {
      return
    }

    let lastFrame = performance.now();
    this.animating = true;
    this.onStart();

    let frameUpdate = function(time) {
      let dt = (time - lastFrame) / 1000;
      lastFrame = time;

      if (this.canceled) {
        return;
      }

      if (dt == 0) {
        return;
      }

      this.value = this.value - this.speed * dt;

      if (this.looping) {
        if (this.value <= 0) {
          this.value += this.loopPhase;
          this.onLoop();
        }
      } else {
        this.value = Math.max(0, this.value);
      }

      this.onUpdate(this.value);

      if (this.value > 0) {
        window.requestAnimationFrame(frameUpdate);
      } else {
        this.animating = false;
        this.onStop();
      }
    }.bind(this);

    window.requestAnimationFrame(frameUpdate);
  }
}