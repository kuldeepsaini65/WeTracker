import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';

const brandColor = Color(0xFF7C3AED);
const _splashAsset = 'assets/brand/splash.png';

/// Shows the animated splash while [ready] completes, then cross-fades into [builder].
///
/// The native launch screen (same colour, same coin at the same size) stays up until the splash image is decoded,
/// so the hand-off from Android to Flutter is seamless.
class StartupGate extends StatefulWidget {
  const StartupGate({super.key, required this.ready, required this.builder});

  final Future<void> ready;
  final WidgetBuilder builder;

  @override
  State<StartupGate> createState() => _StartupGateState();
}

class _StartupGateState extends State<StartupGate> with SingleTickerProviderStateMixin {
  late final _intro = AnimationController(vsync: this, duration: const Duration(milliseconds: 1150));
  bool _showApp = false;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _start();
  }

  Future<void> _start() async {
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    await precacheImage(const AssetImage(_splashAsset), context);
    FlutterNativeSplash.remove(); // first Flutter frame now looks identical to the native screen
    if (reduceMotion) _intro.value = 1;
    // Wait for both the data and the intro, so the animation never gets cut off mid-way.
    final intro = reduceMotion ? Future<void>.value() : _intro.forward().orCancel.catchError((_) {});
    await Future.wait([widget.ready, intro]);
    if (mounted) setState(() => _showApp = true);
  }

  @override
  void dispose() {
    _intro.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 520),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: ScaleTransition(scale: Tween(begin: 0.97, end: 1.0).animate(animation), child: child),
      ),
      child: _showApp
          ? KeyedSubtree(key: const ValueKey('app'), child: widget.builder(context))
          : _SplashView(key: const ValueKey('splash'), animation: _intro),
    );
  }
}

class _SplashView extends StatelessWidget {
  const _SplashView({super.key, required this.animation});
  final Animation<double> animation;

  Animation<double> _interval(double begin, double end, [Curve curve = Curves.easeOutCubic]) => CurvedAnimation(
    parent: animation,
    curve: Interval(begin, end, curve: curve),
  );

  @override
  Widget build(BuildContext context) {
    final pop = _interval(0.0, 0.45, Curves.easeOutBack); // small "tap" on the coin
    final rise = _interval(0.25, 0.75); // coin moves up to make room for the name
    final title = _interval(0.45, 0.85);
    final tagline = _interval(0.6, 1.0);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(statusBarColor: Colors.transparent),
      child: Material(
        color: brandColor,
        child: AnimatedBuilder(
          animation: animation,
          builder: (context, _) {
            // 1 → 1.08 → 0.86: a quick pop, then settle smaller as it rises.
            final popScale = 1 + 0.08 * Curves.easeOut.transform((pop.value * 2).clamp(0, 1)) * (1 - pop.value);
            final scale = popScale * (1 - 0.14 * rise.value);
            return Stack(
              alignment: Alignment.center,
              children: [
                Transform.translate(
                  offset: Offset(0, -64 * rise.value),
                  child: Transform.scale(scale: scale, child: Image.asset(_splashAsset, width: 288, height: 288)),
                ),
                Transform.translate(
                  offset: Offset(0, 92 + 18 * (1 - title.value)),
                  child: Opacity(
                    opacity: title.value,
                    child: const Text(
                      'WeTracker',
                      style: TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w800, letterSpacing: -0.5),
                    ),
                  ),
                ),
                Transform.translate(
                  offset: Offset(0, 136 + 14 * (1 - tagline.value)),
                  child: Opacity(
                    opacity: tagline.value * 0.85,
                    child: const Text('Log every expense in two seconds', style: TextStyle(color: Colors.white, fontSize: 15)),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
