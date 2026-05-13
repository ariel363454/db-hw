#ifndef MAZE_CPP
#define MAZE_CPP

#include <iostream>
#include <string>
#include <cstdlib>
#include <ctime>

using namespace std;

struct PathNode {
    int r, c;
    PathNode* next;
    PathNode(int _r = 0, int _c = 0, PathNode* _next = nullptr)
        : r(_r), c(_c), next(_next) {}
};

inline void freeList(PathNode* head) {
    while (head) {
        PathNode* temp = head;
        head = head->next;
        delete temp;
    }
}

class Maze {
private:
    int n;
    int** grid;
    int sR, sC;
    int eR, eC;

    void generateMaze(unsigned int seed);

public:
    Maze(int size, unsigned int seed = 0);
    ~Maze();

    Maze(const Maze&) = delete;
    Maze& operator=(const Maze&) = delete;

    int  getN() const;
    int  getStartR() const;
    int  getStartC() const;
    int  getEndR() const;
    int  getEndC() const;

    void display() const;
    void displayPath(PathNode* path) const;
    bool validatePath(PathNode* path) const;
    bool isWall(int r, int c) const;

};

// ---- 建構 / 解構 ------------------------------------------------

Maze::Maze(int size, unsigned int seed)
    : n(size + 2), grid(nullptr), sR(0), sC(1), eR(0), eC(0)
{
    if (size < 15)     size = 15;
    if (size % 2 == 0) size++;
    n = size + 2;

    eR = n - 1;
    eC = n - 2;

    grid = new int*[n];
    for (int i = 0; i < n; i++)
        grid[i] = new int[n];

    generateMaze(seed);
}

Maze::~Maze() {
    for (int i = 0; i < n; i++)
        delete[] grid[i];
    delete[] grid;
}

// ---- 迷宮生成（Recursive Backtracker + 邊界）---------------------

void Maze::generateMaze(unsigned int seed) {
    if (seed == 0)
        srand(static_cast<unsigned int>(time(nullptr)));
    else
        srand(seed);

    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++)
            grid[i][j] = 1;

    int inner = n - 2;
    int rooms = (inner + 1) / 2;

    bool** vis = new bool*[rooms];
    for (int i = 0; i < rooms; i++) {
        vis[i] = new bool[rooms];
        for (int j = 0; j < rooms; j++)
            vis[i][j] = false;
    }

    struct Cell { int r, c; };
    Cell* stk = new Cell[rooms * rooms];
    int top = -1;

    vis[0][0] = true;
    grid[1][1] = 0;
    stk[++top] = {0, 0};

    const int dr[] = {-1, 1, 0, 0};
    const int dc[] = {0, 0, -1, 1};

    while (top >= 0) {
        Cell cur = stk[top];

        Cell nbr[4];
        int cnt = 0;
        for (int d = 0; d < 4; d++) {
            int nr = cur.r + dr[d];
            int nc = cur.c + dc[d];
            if (nr >= 0 && nr < rooms && nc >= 0 && nc < rooms && !vis[nr][nc])
                nbr[cnt++] = {nr, nc};
        }

        if (cnt > 0) {
            int pick = rand() % cnt;
            int nr = nbr[pick].r;
            int nc = nbr[pick].c;

            grid[cur.r + nr + 1][cur.c + nc + 1] = 0;
            grid[nr * 2 + 1][nc * 2 + 1]         = 0;

            vis[nr][nc] = true;
            stk[++top] = {nr, nc};
        } else {
            top--;
        }
    }

    int extra = (inner * inner) / 8;
    int attempts = 0;
    while (extra > 0 && attempts < inner * inner * 2) {
        int r = 1 + rand() % inner;
        int c = 1 + rand() % inner;
        if (grid[r][c] == 1) {
            grid[r][c] = 0;
            extra--;
        }
        attempts++;
    }

    grid[sR][sC] = 0;
    grid[1][1]         = 0;
    grid[eR][eC]       = 0;

    delete[] stk;
    for (int i = 0; i < rooms; i++)
        delete[] vis[i];
    delete[] vis;
}

// ---- 查詢 -------------------------------------------------------

int  Maze::getN()      const { return n; }
int  Maze::getStartR() const { return sR; }
int  Maze::getStartC() const { return sC; }
int  Maze::getEndR()   const { return eR; }
int  Maze::getEndC()   const { return eC; }
bool Maze::isWall(int r, int c) const{
    if(r < 0 || r >= n || c < 0 || c >= n)
        return true;
    if(grid[r][c] == 1)
        return true;
    return false;
}

// ---- 顯示輔助 ---------------------------------------------------

static bool isBorder(int i, int j, int n) {
    return i == 0 || i == n - 1 || j == 0 || j == n - 1;
}

static char borderChar(int i, int j, int n) {
    bool top    = (i == 0);
    bool bottom = (i == n - 1);
    bool left   = (j == 0);
    bool right  = (j == n - 1);

    if ((top && left) || (top && right) || (bottom && left) || (bottom && right))
        return '+';
    if (top || bottom)
        return '-';
    return '|';
}

// ---- 顯示 -------------------------------------------------------

void Maze::display() const {
    cout << "\n";
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            if (i == sR && j == sC)
                cout << "S ";
            else if (i == eR && j == eC)
                cout << "E ";
            else if (isBorder(i, j, n) && grid[i][j] == 1)
                cout << borderChar(i, j, n) << " ";
            else
                cout << (grid[i][j] ? "# " : ". ");
        }
        cout << "\n";
    }
    cout << "\n";
}

// ---- 並排顯示 ---------------------------------------------------

void Maze::displayPath(PathNode* path) const {
    bool** onPath = new bool*[n];
    for (int i = 0; i < n; i++) {
        onPath[i] = new bool[n]();
    }
    for (PathNode* cur = path; cur; cur = cur->next)
        onPath[cur->r][cur->c] = true;

    int mazeWidth = n * 2;
    string titleL = "Maze";
    string titleR = "Path";
    int padL = (mazeWidth - (int)titleL.size()) / 2;
    int padR = (mazeWidth - (int)titleR.size()) / 2;

    cout << "\n";
    cout << string(padL, ' ') << titleL << string(mazeWidth - padL - (int)titleL.size(), ' ')
         << "    "
         << string(padR, ' ') << titleR << "\n";

    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            if (i == sR && j == sC)
                cout << "S ";
            else if (i == eR && j == eC)
                cout << "E ";
            else if (isBorder(i, j, n) && grid[i][j] == 1)
                cout << borderChar(i, j, n) << " ";
            else
                cout << (grid[i][j] ? "# " : ". ");
        }

        cout << "    ";

        for (int j = 0; j < n; j++) {
            if (i == sR && j == sC)
                cout << "S ";
            else if (i == eR && j == eC)
                cout << "E ";
            else if (onPath[i][j])
                cout << "* ";
            else if (isBorder(i, j, n) && grid[i][j] == 1)
                cout << borderChar(i, j, n) << " ";
            else
                cout << (grid[i][j] ? "  " : "  ");
        }
        cout << "\n";
    }
    cout << "\n";

    for (int i = 0; i < n; i++)
        delete[] onPath[i];
    delete[] onPath;
}

// ---- 路徑驗證 ---------------------------------------------------

bool Maze::validatePath(PathNode* path) const {//檢查path是否合法,如果不合法回傳false
    if(path == nullptr)//檢查path是不是nullptr
        return false;
    if(path -> r != sR || path -> c != sC)//檢查path的起點是不是迷宮起點
        return false;
    PathNode* current = path;//從path的第一個點開始檢查每個點是否合法
    if(isWall(current -> r, current -> c))//檢查起點是不是牆
        return false;
    while(current -> next != nullptr){//檢查current的下一個點是否合法
        if (current->r < 0 || current->r >= n || current->c < 0 || current->c >= n)//current的座標有沒有在迷宮裡面
            return false;
        PathNode* nextNode = current -> next;//拿到current的下一個點
        int dist = abs(nextNode -> r - current -> r) + abs(nextNode -> c - current -> c);//計算current和nextNode的距離
        if(dist != 1)//檢查距離是不是1
            return false;
        if(isWall(nextNode -> r, nextNode -> c))//檢查nextNode是不是牆
            return false;
        current = nextNode;//current往下一個點移動
    }
    if(current -> r == eR && current -> c == eC)//檢查path的終點是不是迷宮終點
        return true;//如果檢查都對，回傳true
    return false;
}


#endif
