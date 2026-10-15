import 'package:flutter/material.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:quick_actions/quick_actions.dart';

import 'store.dart';
import 'ui/home_shell.dart';
import 'ui/login_screen.dart';
import 'ui/quick_add_sheet.dart';
import 'ui/splash.dart';

final navigatorKey = GlobalKey<NavigatorState>();

void main() {
  // Keep the native launch screen up until our animated splash has its first frame ready.
  FlutterNativeSplash.preserve(widgetsBinding: WidgetsFlutterBinding.ensureInitialized());
  runApp(const WeTrackerApp());
}

class WeTrackerApp extends StatefulWidget {
  const WeTrackerApp({super.key});

  @override
  State<WeTrackerApp> createState() => _WeTrackerAppState();
}

class _WeTrackerAppState extends State<WeTrackerApp> {
  final store = AppStore.instance;
  // Loads saved login + settings while the splash animation plays.
  late final Future<void> _ready = store.init();

  @override
  void initState() {
    super.initState();
    // Long-press app icon → "Add expense"
    const actions = QuickActions();
    actions.initialize((type) {
      if (type != 'add_expense') return;
      final ctx = navigatorKey.currentContext;
      if (ctx != null && store.user != null) {
        showQuickAdd(ctx);
      } else {
        store.quickAddRequested = true; // cold start: HomeShell opens it once mounted
      }
    });
    actions.setShortcutItems(const [ShortcutItem(type: 'add_expense', localizedTitle: 'Add expense', icon: 'ic_launcher')]);
  }

  ThemeData _theme(Brightness b) {
    final scheme = ColorScheme.fromSeed(seedColor: const Color(0xFF7C3AED), brightness: b);
    return ThemeData(
      colorScheme: scheme,
      useMaterial3: true,
      // Smooth fade-and-slide between screens
      pageTransitionsTheme: const PageTransitionsTheme(builders: {TargetPlatform.android: FadeForwardsPageTransitionsBuilder()}),
      inputDecorationTheme: InputDecorationTheme(border: OutlineInputBorder(borderRadius: BorderRadius.circular(14))),
      chipTheme: ChipThemeData(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20))),
      floatingActionButtonTheme: FloatingActionButtonThemeData(backgroundColor: scheme.primary, foregroundColor: scheme.onPrimary),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'WeTracker',
      navigatorKey: navigatorKey,
      debugShowCheckedModeBanner: false,
      theme: _theme(Brightness.light),
      darkTheme: _theme(Brightness.dark),
      home: StartupGate(
        ready: _ready,
        builder: (_) => ListenableBuilder(
          listenable: store,
          // Cross-fade between login and the app (and back on logout)
          builder: (_, _) => AnimatedSwitcher(
            duration: const Duration(milliseconds: 350),
            child: store.user == null
                ? const LoginScreen(key: ValueKey('login'))
                : HomeShell(key: ValueKey(store.user!.email), openQuickAdd: store.openQuickAddOnLaunch),
          ),
        ),
      ),
    );
  }
}
