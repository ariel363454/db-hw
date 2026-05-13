#ifndef STUDENTSOLVER_CPP
#define STUDENTSOLVER_CPP

#include "Maze.cpp"

void DFSpush(PathNode*& top, int r, int c){//把新結點放入stack
    PathNode* newNode = new PathNode(r, c, top);//建立新節點，把新結點放在top的上面
    top = newNode;//更新top
}
void DFSpop(PathNode*& top, int& r, int& c){
    r = top -> r;//先暫存節點座標
    c = top -> c;
    PathNode* temp = top;//先用temp暫存top
    top = top -> next;//把舊的top拿出stack
    delete temp;//刪掉tamp釋放記憶體
}
bool solveByDFS(const Maze& maze, PathNode*& path){
    int n = maze.getN();//先拿到迷宮的大小，起點和終點座標
    int sr = maze.getStartR();
    int sc = maze.getStartC();
    int er = maze.getEndR();
    int ec = maze.getEndC();
    int dr[4] = {-1, 1, 0, 0};//上下左右的移動方向
    int dc[4] = {0, 0, -1, 1};
    bool** visited = new bool*[n];//visited記錄有沒有走過這個點
    int** parentR = new int*[n];//parentR和parentC記錄每個點的父節點座標
    int** parentC = new int*[n];
    for(int i = 0; i < n; i++){
        visited[i] = new bool[n]();//初始化為false
        parentR[i] = new int[n];
        parentC[i] = new int[n];
        for(int j = 0; j < n; j++){//初始化座標為-1
            parentR[i][j] = -1; 
            parentC[i][j] = -1;
        }
    }
    PathNode* top = nullptr;
    DFSpush(top, sr, sc);//先把起點放入stack
    visited[sr][sc] = true;//紀錄起點已經走過了
    int r, c;
    while(top != nullptr){//直到stack清空
        DFSpop(top, r, c);//把stack最上面的點pop掉
        if(r == er && c == ec)//如果是終點就跳出去
            break;
        for(int i = 0;i < 4;i++){//往四個方向的鄰居走
            int nbr = r + dr[i];
            int nbc = c + dc[i];
            if((0 <= nbr && nbr < n && 0 <= nbc && nbc < n && !maze.isWall(nbr, nbc) && !visited[nbr][nbc])){//如果鄰居在迷宮裡面、不是牆也沒走過
                parentR[nbr][nbc] = r;//紀錄這個鄰居的父節點座標
                parentC[nbr][nbc] = c;
                DFSpush(top, nbr, nbc);//鄰居push進stack
                visited[nbr][nbc] = true;//紀錄這個鄰居被走過了
            }
        }
        
    }
    if(r == er && c == ec){//如果座標在終點，代表有找到，回頭找路徑
        int cr = er;
        int cc = ec;
        path = nullptr;
        while(cr != -1 && cc != -1){//從終點開始往回找父節點，直到回到起點
            PathNode* newNode = new PathNode(cr, cc, path);//建立新節點，把新節點插在path的前面
            path = newNode;//更新path
            int nr = parentR[cr][cc];//從parentR和parentC拿到父節點座標，繼續往上找
            int nc = parentC[cr][cc];
            cr = nr;//更新新的父節點
            cc = nc;
        }
    }
    while(top != nullptr)//清空剩下的stack
        DFSpop(top, r, c);
    for (int i = 0; i < n; i++){//釋放記憶體
        delete[] visited[i];
        delete[] parentR[i];
        delete[] parentC[i];
    }
    delete[] visited;
    delete[] parentR;
    delete[] parentC;

    return (path != nullptr);//如果path不是nullptr就是有找到路徑
}
void enqueue(PathNode*& head, PathNode*& tail, int r, int c){//把新結點放入queue
    PathNode* newNode = new PathNode(r, c, nullptr);//建立新節點
    if(head == nullptr){//如果queue是空的，head和tail都指向新節點
        head = newNode;
        tail = newNode;
    }else{
        tail -> next = newNode;//把新節點放在tail的後面
        tail = tail -> next;//更新tail
    }
    
}
bool dequeue(PathNode*& head, PathNode*& tail, int& r, int& c){//把queue先放進去的點拿出來
    if(head == nullptr)//如果queue是空的，回傳false
        return false;
    r = head -> r;//先暫存head的座標
    c = head -> c;
    PathNode* temp = head;//用temp暫存head
    head = head -> next;//把head往後移一個
    if(head == nullptr)//如果queue變空了，tail也要更新為nullptr
        tail = nullptr;
    delete temp;//刪掉temp釋放記憶體
    return true;
}
bool solveByBFS(const Maze& maze, PathNode*& path){
    int n = maze.getN();//先拿到迷宮的大小，起點和終點座標
    int sr = maze.getStartR();
    int sc = maze.getStartC();
    int er = maze.getEndR();
    int ec = maze.getEndC();
    int dr[4] = {-1, 1, 0, 0};//上下左右的移動方向
    int dc[4] = {0, 0, -1, 1};
    bool** visited = new bool*[n];//visited記錄有沒有走過這個點
    int** parentR = new int*[n];//parentR和parentC記錄每個點的父節點座標
    int** parentC = new int*[n];
    for(int i = 0; i < n; i++){
        visited[i] = new bool[n](); //初始化為false
        parentR[i] = new int[n];
        parentC[i] = new int[n];
        for(int j = 0; j < n; j++){
            parentR[i][j] = -1; //初始化座標為-1
            parentC[i][j] = -1;
        }
    }
    PathNode* head = nullptr;
    PathNode* tail = nullptr;
    enqueue(head, tail, sr, sc);//先把起點放入queue
    visited[sr][sc] = true;//紀錄起點已經走過了
    int r, c;
    while(head != nullptr){//直到queue清空
        dequeue(head, tail, r, c);//把queue先放進去的點dequeue掉
        if(r == er && c == ec)//如果是終點就跳出去
            break;
        for(int i = 0;i < 4;i++){//往四個方向的鄰居走
            int nbr = r + dr[i];
            int nbc = c + dc[i];
            if((0 <= nbr && nbr < n && 0 <= nbc && nbc < n && !maze.isWall(nbr, nbc) && !visited[nbr][nbc])){//如果鄰居在迷宮裡面、不是牆也沒走過
                parentR[nbr][nbc] = r;//紀錄這個鄰居的父節點座標
                parentC[nbr][nbc] = c;
                enqueue(head, tail, nbr, nbc);//鄰居enqueue進queue
                visited[nbr][nbc] = true;//紀錄這個鄰居被走過了
            }
        }
    }
    if(r == er && c == ec){//如果座標在終點，代表有找到，回頭找路徑
        int cr = er;
        int cc = ec;
        path = nullptr;
        while(cr != -1 && cc != -1){//從終點開始往回找父節點，直到回到起點
            PathNode* newNode = new PathNode(cr, cc, path);//建立新節點，把新節點插在path的前面
            path = newNode;//更新path
            int nr = parentR[cr][cc];//從parentR和parentC拿到父節點座標，繼續往上找
            int nc = parentC[cr][cc];
            cr = nr;//更新新的父節點
            cc = nc;
        }
    }
    while(head != nullptr)//清空剩下的queue
        dequeue(head, tail, r, c);
    for (int i = 0; i < n; i++){//釋放記憶體
        delete[] visited[i];
        delete[] parentR[i];
        delete[] parentC[i];
    }
    delete[] visited;
    delete[] parentR;
    delete[] parentC;

    return (path != nullptr);//如果path不是nullptr就是有找到路徑
}

#endif
