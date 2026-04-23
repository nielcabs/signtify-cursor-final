# Signtify Project Flowchart

## System Architecture Flowchart

```mermaid
flowchart TD
    Start([User Opens Application]) --> AuthCheck{User Authenticated?}
    
    AuthCheck -->|No| AuthPage[Authentication Page]
    AuthCheck -->|Yes| HomePage[Home Page]
    
    AuthPage --> Login[Login]
    AuthPage --> Register[Register]
    AuthPage --> ForgotPass[Forgot Password]
    
    Login --> FirebaseAuth[Firebase Authentication]
    Register --> FirebaseAuth
    ForgotPass --> FirebaseAuth
    
    FirebaseAuth -->|Success| FirestoreInit[Initialize User Profile in Firestore]
    FirebaseAuth -->|Admin User| AdminCheck[Check Admin Status]
    FirebaseAuth -->|Regular User| HomePage
    
    FirestoreInit --> HomePage
    AdminCheck -->|Is Admin| AdminDashboard[Admin Dashboard]
    AdminCheck -->|Not Admin| HomePage
    
    HomePage --> Lessons[Lessons Section]
    HomePage --> Quizzes[Quizzes Section]
    HomePage --> Exams[Proficiency Exams]
    HomePage --> Dictionary[Dictionary]
    HomePage --> LiveTranslate[Live Translate]
    HomePage --> Profile[User Profile]
    
    Lessons --> LessonAlphabet[Alphabet Lesson]
    Lessons --> LessonGreetings[Greetings Lesson]
    
    LessonAlphabet --> MarkComplete[Mark Lesson Complete]
    LessonGreetings --> MarkComplete
    MarkComplete --> UpdateProgress[Update Progress in Firestore]
    UpdateProgress --> AwardPoints[Award Points +50]
    
    Quizzes --> QuizList[Select Quiz]
    QuizList --> TakeQuiz[Take Quiz]
    TakeQuiz --> SubmitQuiz[Submit Answers]
    SubmitQuiz --> CalculateScore[Calculate Score]
    CalculateScore --> UpdateProgress
    
    Quizzes --> MiniQuizAlphabet[Mini Quiz: Alphabet]
    Quizzes --> MiniQuizGreetings[Mini Quiz: Greetings]
    
    Exams --> ExamList[Select Proficiency Exam]
    ExamList --> TakeExam[Take Exam]
    TakeExam --> SubmitExam[Submit Exam]
    SubmitExam --> CalculateScore
    
    LiveTranslate --> StartCamera[Start Camera]
    StartCamera --> MediaPipe[MediaPipe Holistic Detection]
    MediaPipe --> ExtractKeypoints[Extract Keypoints<br/>1662 features]
    ExtractKeypoints --> BuildSequence[Build 30-Frame Sequence]
    BuildSequence -->|30 frames collected| FlaskAPI[Send to Flask API<br/>POST /predict]
    FlaskAPI --> MLModel[TensorFlow/Keras Model<br/>GRU Neural Network]
    MLModel --> Prediction[Get Prediction<br/>hello, thanks, iloveyou,<br/>yes, no, nothing]
    Prediction --> ConfidenceCheck{Confidence > 70%?}
    ConfidenceCheck -->|Yes| StabilityCheck{Stable 3 frames?}
    ConfidenceCheck -->|No| ContinueDetection[Continue Detection]
    StabilityCheck -->|Yes| DisplaySign[Display Detected Sign]
    StabilityCheck -->|No| ContinueDetection
    DisplaySign --> TranslationHistory[Add to Translation History]
    ContinueDetection --> MediaPipe
    
    Dictionary --> BrowseSigns[Browse Sign Language Dictionary]
    BrowseSigns --> ViewSign[View Sign Details]
    
    Profile --> ViewProgress[View Learning Progress]
    Profile --> ViewAchievements[View Achievements]
    Profile --> ViewStats[View Statistics]
    
    AdminDashboard --> UserMgmt[User Management]
    AdminDashboard --> QuizMgmt[Quiz Management]
    AdminDashboard --> ExamMgmt[Exam Management]
    AdminDashboard --> DictMgmt[Dictionary Management]
    
    UserMgmt --> CRUDUsers[Create/Read/Update/Delete Users]
    QuizMgmt --> CRUDQuizzes[Create/Read/Update/Delete Quizzes]
    ExamMgmt --> CRUDExams[Create/Read/Update/Delete Exams]
    DictMgmt --> CRUDDictionary[Create/Read/Update/Delete Dictionary Entries]
    
    style Start fill:#e1f5ff
    style HomePage fill:#c8e6c9
    style AdminDashboard fill:#ffccbc
    style LiveTranslate fill:#fff9c4
    style MLModel fill:#f8bbd0
    style FirebaseAuth fill:#bbdefb
    style FirestoreInit fill:#bbdefb
```

## Authentication Flow

```mermaid
flowchart LR
    A[User Action] --> B{Action Type}
    B -->|Login| C[Login Form]
    B -->|Register| D[Register Form]
    B -->|Forgot Password| E[Password Reset Form]
    
    C --> F[Firebase Auth: signInWithEmailAndPassword]
    D --> G[Firebase Auth: createUserWithEmailAndPassword]
    E --> H[Firebase Auth: sendPasswordResetEmail]
    
    F --> I{Success?}
    G --> J{Success?}
    H --> K[Email Sent]
    
    I -->|Yes| L[Update Last Login in Firestore]
    I -->|No| M[Show Error]
    
    J -->|Yes| N[Initialize User Profile in Firestore]
    J -->|No| M
    
    L --> O[Check Admin Status]
    N --> O
    O --> P{Is Admin?}
    P -->|Yes| Q[Set Admin Flag]
    P -->|No| R[Regular User]
    Q --> S[Redirect to Admin Dashboard]
    R --> T[Redirect to Home]
    
    style F fill:#bbdefb
    style G fill:#bbdefb
    style H fill:#bbdefb
    style O fill:#ffccbc
```

## Live Translation ML Pipeline

```mermaid
flowchart TD
    A[Start Live Translate] --> B[Request Camera Access]
    B --> C{Camera Access Granted?}
    C -->|No| D[Show Error]
    C -->|Yes| E[Initialize MediaPipe Holistic]
    
    E --> F[Start Video Capture Loop]
    F --> G[Capture Frame]
    G --> H[MediaPipe Processes Frame]
    H --> I[Extract Landmarks]
    
    I --> J[Pose: 33 landmarks × 4 = 132]
    I --> K[Face: 468 landmarks × 3 = 1404]
    I --> L[Left Hand: 21 landmarks × 3 = 63]
    I --> M[Right Hand: 21 landmarks × 3 = 63]
    
    J --> N[Combine to 1662 features]
    K --> N
    L --> N
    M --> N
    
    N --> O[Add to Sequence Buffer]
    O --> P{Sequence Length = 30?}
    P -->|No| F
    P -->|Yes| Q[Send to Flask Server]
    
    Q --> R[Flask: /predict endpoint]
    R --> S[Preprocess: Convert to NumPy Array]
    S --> T[Reshape: 1, 30, 1662]
    T --> U[Load TensorFlow Model]
    
    U --> V[GRU Layer 1: 128 units]
    V --> W[BatchNorm + Dropout]
    W --> X[GRU Layer 2: 256 units]
    X --> Y[BatchNorm + Dropout]
    Y --> Z[GRU Layer 3: 128 units]
    Z --> AA[BatchNorm + Dropout]
    AA --> AB[Dense: 128 units]
    AB --> AC[Dense: 64 units]
    AC --> AD[Output: 6 classes Softmax]
    
    AD --> AE[Get Prediction & Confidence]
    AE --> AF{Confidence > 70%?}
    AF -->|No| F
    AF -->|Yes| AG{Same Sign 3x in a row?}
    AG -->|No| F
    AG -->|Yes| AH[Display Detected Sign]
    AH --> AI[Add to Translation History]
    AI --> F
    
    style U fill:#f8bbd0
    style AD fill:#f8bbd0
    style R fill:#fff9c4
```

## User Learning Journey

```mermaid
flowchart TD
    A[New User Registers] --> B[Initialize Profile in Firestore]
    B --> C[Home Page]
    
    C --> D{Choose Learning Path}
    
    D -->|Lessons| E[Start Alphabet Lesson]
    D -->|Practice| F[Take Mini Quiz]
    D -->|Test| G[Take Proficiency Exam]
    D -->|Explore| H[Browse Dictionary]
    D -->|Translate| I[Use Live Translate]
    
    E --> J[View Letter Signs]
    J --> K[Complete Lesson]
    K --> L[Mark as Complete]
    L --> M[+50 Points Awarded]
    M --> N[Update Progress in Firestore]
    
    F --> O[Answer Questions]
    O --> P[Submit Quiz]
    P --> Q[Calculate Score]
    Q --> R{Score >= 70%?}
    R -->|Yes| S[Quiz Passed]
    R -->|No| T[Quiz Failed]
    S --> M
    T --> U[Retake Quiz]
    
    G --> V[Answer Exam Questions]
    V --> W[Submit Exam]
    W --> X[Calculate Score]
    X --> Y{Score >= 80%?}
    Y -->|Yes| Z[Exam Passed - Certificate]
    Y -->|No| AA[Exam Failed]
    Z --> AB[Update Proficiency Level]
    AB --> N
    AA --> AC[Retake Exam]
    
    H --> AD[View Sign Details]
    AD --> AE[Learn Sign Meaning]
    
    I --> AF[Real-time Sign Detection]
    AF --> AG[See Translation]
    
    N --> AH[Update Profile Stats]
    AH --> AI[View Progress Dashboard]
    AI --> D
    
    style M fill:#c8e6c9
    style Z fill:#fff9c4
    style N fill:#bbdefb
```

## Admin Management Flow

```mermaid
flowchart TD
    A[Admin Logs In] --> B[Admin Dashboard]
    B --> C{Select Management Section}
    
    C -->|Users| D[User Management]
    C -->|Quizzes| E[Quiz Management]
    C -->|Exams| F[Exam Management]
    C -->|Dictionary| G[Dictionary Management]
    
    D --> H[View All Users]
    H --> I{Action?}
    I -->|View| J[View User Details]
    I -->|Edit| K[Edit User Info]
    I -->|Delete| L[Delete User]
    I -->|Promote| M[Promote to Admin]
    
    E --> N[View All Quizzes]
    N --> O{Action?}
    O -->|Create| P[Create New Quiz]
    O -->|Edit| Q[Edit Quiz]
    O -->|Delete| R[Delete Quiz]
    
    P --> S[Add Questions]
    S --> T[Set Correct Answers]
    T --> U[Save to Firestore]
    
    F --> V[View All Exams]
    V --> W{Action?}
    W -->|Create| X[Create New Exam]
    W -->|Edit| Y[Edit Exam]
    W -->|Delete| Z[Delete Exam]
    
    X --> AA[Add Exam Questions]
    AA --> AB[Set Passing Score]
    AB --> U
    
    G --> AC[View Dictionary Entries]
    AC --> AD{Action?}
    AD -->|Create| AE[Add New Sign]
    AD -->|Edit| AF[Edit Sign Entry]
    AD -->|Delete| AG[Delete Sign Entry]
    
    AE --> AH[Add Sign Details]
    AH --> AI[Add Image/Video]
    AI --> U
    
    K --> U
    Q --> U
    Y --> U
    AF --> U
    
    style B fill:#ffccbc
    style U fill:#bbdefb
```

## Data Flow Architecture

```mermaid
flowchart LR
    subgraph Frontend["Frontend (React + Vite)"]
        A[React Components]
        B[React Router]
        C[Auth Context]
    end
    
    subgraph Firebase["Firebase Services"]
        D[Firebase Auth]
        E[Cloud Firestore]
    end
    
    subgraph Backend["Backend (Flask)"]
        F[Flask Server]
        G[TensorFlow Model]
    end
    
    subgraph ML["ML Pipeline"]
        H[MediaPipe Holistic]
        I[Keypoint Extraction]
        J[Sequence Building]
    end
    
    A --> B
    B --> C
    C --> D
    C --> E
    
    A -->|POST /predict| F
    F --> G
    G -->|Prediction| A
    
    A -->|Video Stream| H
    H --> I
    I --> J
    J -->|30 frames| F
    
    A -->|User Data| E
    E -->|Progress Data| A
    
    style Frontend fill:#c8e6c9
    style Firebase fill:#bbdefb
    style Backend fill:#fff9c4
    style ML fill:#f8bbd0
```

## Technology Stack

- **Frontend**: React 19, React Router, Vite
- **Backend**: Flask (Python)
- **ML Framework**: TensorFlow/Keras
- **Computer Vision**: MediaPipe Holistic
- **Authentication**: Firebase Auth
- **Database**: Cloud Firestore
- **Styling**: CSS with animations (GSAP)

## Key Features

1. **User Authentication**: Login, Register, Password Reset, Google Sign-In
2. **Lessons**: Interactive alphabet and greetings lessons
3. **Quizzes**: Mini quizzes and full quizzes with scoring
4. **Proficiency Exams**: Certification exams with passing scores
5. **Dictionary**: Browse sign language dictionary
6. **Live Translation**: Real-time sign language detection using ML model
7. **Progress Tracking**: Points, achievements, and learning statistics
8. **Admin Dashboard**: User, quiz, exam, and dictionary management










