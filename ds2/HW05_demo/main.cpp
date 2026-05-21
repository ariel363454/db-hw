#include "StudentSolver.cpp"

using namespace std;

static void run() {
    int n;
    cout << "Enter maze size (odd number >= 15): ";
    cin >> n;

    if (n < 15)     { cout << "Too small, using n = 15\n"; n = 15; }
    if (n > 99)     { cout << "Too large, using n = 99\n"; n = 99; }
    if (n % 2 == 0) { n--; cout << "Must be odd, using n = " << n << "\n"; }

    unsigned int seed;
    cout << "Enter random seed (0 = random): ";
    cin >> seed;

    Maze maze(n, seed);

    // DFS
    cout << "\n========== DFS ==========" << endl;
    PathNode* dfsPath = nullptr;
    if (solveByDFS(maze, dfsPath)) {
        cout << "DFS: path found!" << endl;
        maze.displayPath(dfsPath);
        maze.validatePath(dfsPath);
    } else {
        cout << "DFS: no path found." << endl;
        maze.display();
    }
    freeList(dfsPath);

    // BFS
    cout << "\n========== BFS ==========" << endl;
    PathNode* bfsPath = nullptr;
    if (solveByBFS(maze, bfsPath)) {
        cout << "BFS: path found!" << endl;
        maze.displayPath(bfsPath);
        maze.validatePath(bfsPath);
    } else {
        cout << "BFS: no path found." << endl;
        maze.display();
    }
    freeList(bfsPath);
}

// ---- 計算路徑長度 -----------------------------------------------

static int pathLength(PathNode* p) {
    int len = 0;
    for (PathNode* c = p; c; c = c->next) len++;
    return len;
}

// ---- 自動測試模式 -----------------------------------------------

static int autoTest() {
    int pass = 0, fail = 0;

    struct TestCase { int n; unsigned int seed; bool solvable; };
    TestCase cases[] = {
        {15,  42, true},
        {20,  99, true},
        {17,  42, true},
        {69, 200, true},
        {19, 123, true},
        {99, 777, true},
    };
    int numCases = sizeof(cases) / sizeof(cases[0]);

    for (int t = 0; t < numCases; t++) {
        TestCase& tc = cases[t];
        cout << "\n--- Test " << (t + 1)
                  << "  n=" << tc.n << "  seed=" << tc.seed
                  << " ---" << endl;

        Maze maze(tc.n, tc.seed);
        maze.display();

        // DFS
        PathNode* dfsPath = nullptr;
        bool dfsOk = solveByDFS(maze, dfsPath);
        if (tc.solvable) {
            if (dfsOk && maze.validatePath(dfsPath)) {
                cout << "  DFS: PASS\n"; pass++;
            } else {
                cout << "  DFS: FAIL (expected path)\n"; fail++;
            }
        } else {
            if (!dfsOk && dfsPath == nullptr) {
                cout << "  DFS: PASS (correctly no path)\n"; pass++;
            } else {
                cout << "  DFS: FAIL (expected no path)\n"; fail++;
            }
        }

        // BFS
        PathNode* bfsPath = nullptr;
        bool bfsOk = solveByBFS(maze, bfsPath);
        if (tc.solvable) {
            if (bfsOk && maze.validatePath(bfsPath)) {
                cout << "  BFS: PASS\n"; pass++;
            } else {
                cout << "  BFS: FAIL (expected path)\n"; fail++;
            }
        } else {
            if (!bfsOk && bfsPath == nullptr) {
                cout << "  BFS: PASS (correctly no path)\n"; pass++;
            } else {
                cout << "  BFS: FAIL (expected no path)\n"; fail++;
            }
        }

        // BFS 路徑應 <= DFS 路徑
        if (tc.solvable && dfsOk && bfsOk) {
            int dLen = pathLength(dfsPath);
            int bLen = pathLength(bfsPath);
            cout << "  DFS steps=" << dLen - 1
                      << "  BFS steps=" << bLen - 1;
            if (bLen <= dLen)
                cout << "  (BFS <= DFS: OK)\n";
            else
                cout << "  (BFS > DFS: WARNING)\n";
        }

        freeList(dfsPath);
        freeList(bfsPath);
    }

    cout << "\n============================\n"
              << "  PASS: " << pass << "  FAIL: " << fail
              << "\n============================\n";

    return fail;
}

// ---- main -------------------------------------------------------

int main(int argc, char* argv[]) {
    if (argc > 1 && string(argv[1]) == "--test") {
        int result = autoTest();
        cout << "\nPress Enter to exit...";
        cin.ignore();
        cin.get();
        return result;
    }
    run();
    cout << "\nPress Enter to exit...";
    cin.ignore();
    cin.get();
    return 0;
}
