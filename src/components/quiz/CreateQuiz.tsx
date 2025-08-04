import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PlusCircle,
  Trash2,
  Save,
  Plus,
  Minus,
  Upload,
  Download,
} from "lucide-react";
import { supabase } from "../../../supabase/supabase";
import { useAuth } from "../auth/VercelAuthProvider";
import { useToast } from "@/components/ui/use-toast";
import Logo from "@/components/ui/logo";
import { Link } from "react-router-dom";
import UserMenu from "@/components/ui/user-menu";

interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  text: string;
  timeLimit: number;
  options: Option[];
}

interface QuizData {
  title: string;
  description: string;
  questions: Question[];
}

// Helper function to generate unique IDs
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

const CreateQuiz = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { quizId } = useParams<{ quizId: string }>();

  // State management
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [quizData, setQuizData] = useState<QuizData>({
    title: "",
    description: "",
    questions: [
      {
        id: generateId(),
        text: "",
        timeLimit: 30,
        options: [
          { id: generateId(), text: "", isCorrect: false },
          { id: generateId(), text: "", isCorrect: false },
        ],
      },
    ],
  });

  // Load quiz data if editing
  useEffect(() => {
    if (quizId) {
      setIsEditing(true);
      loadExistingQuiz(quizId.trim());
    }
  }, [quizId]);

  // Load existing quiz data
  const loadExistingQuiz = async (id: string) => {
    try {
      setInitialLoading(true);

      // Fetch quiz details
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", id)
        .single();

      if (quizError)
        throw new Error(`Failed to load quiz: ${quizError.message}`);
      if (!quiz) throw new Error("Quiz not found");

      // Fetch questions with their options
      const { data: questions, error: questionsError } = await supabase
        .from("questions")
        .select(
          `
          *,
          options (*)
        `,
        )
        .eq("quiz_id", id)
        .order("created_at", { ascending: true });

      if (questionsError)
        throw new Error(`Failed to load questions: ${questionsError.message}`);

      // Transform data to match our interface
      const transformedQuestions: Question[] = (questions || []).map((q) => ({
        id: String(q.id),
        text: q.text || "",
        timeLimit: q.time_limit || 30,
        options: (q.options || []).map((opt: any) => ({
          id: String(opt.id),
          text: opt.text || "",
          isCorrect: opt.is_correct || false,
        })),
      }));

      setQuizData({
        title: quiz.title || "",
        description: quiz.description || "",
        questions:
          transformedQuestions.length > 0
            ? transformedQuestions
            : [
                {
                  id: generateId(),
                  text: "",
                  timeLimit: 30,
                  options: [
                    { id: generateId(), text: "", isCorrect: false },
                    { id: generateId(), text: "", isCorrect: false },
                  ],
                },
              ],
      });
    } catch (error: any) {
      console.error("Error loading quiz:", error);
      toast({
        title: "Error loading quiz",
        description: error.message || "Failed to load quiz data",
        variant: "destructive",
      });
      navigate("/host");
    } finally {
      setInitialLoading(false);
    }
  };

  // Update quiz title
  const updateTitle = (title: string) => {
    setQuizData((prev) => ({ ...prev, title }));
  };

  // Update quiz description
  const updateDescription = (description: string) => {
    setQuizData((prev) => ({ ...prev, description }));
  };

  // Add new question
  const addQuestion = () => {
    const newQuestion: Question = {
      id: generateId(),
      text: "",
      timeLimit: 30,
      options: [
        { id: generateId(), text: "", isCorrect: false },
        { id: generateId(), text: "", isCorrect: false },
      ],
    };
    setQuizData((prev) => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }));
  };

  // Remove question
  const removeQuestion = (questionId: string) => {
    if (quizData.questions.length <= 1) {
      toast({
        title: "Cannot remove question",
        description: "Quiz must have at least one question",
        variant: "destructive",
      });
      return;
    }
    setQuizData((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== questionId),
    }));
  };

  // Update question
  const updateQuestion = (
    questionId: string,
    field: keyof Question,
    value: any,
  ) => {
    setQuizData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId ? { ...q, [field]: value } : q,
      ),
    }));
  };

  // Add option to question
  const addOption = (questionId: string) => {
    const question = quizData.questions.find((q) => q.id === questionId);
    if (!question) return;

    if (question.options.length >= 10) {
      toast({
        title: "Maximum options reached",
        description: "A question can have maximum 10 options",
        variant: "destructive",
      });
      return;
    }

    const newOption: Option = {
      id: generateId(),
      text: "",
      isCorrect: false,
    };

    setQuizData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId ? { ...q, options: [...q.options, newOption] } : q,
      ),
    }));
  };

  // Remove option from question
  const removeOption = (questionId: string, optionId: string) => {
    const question = quizData.questions.find((q) => q.id === questionId);
    if (!question) return;

    if (question.options.length <= 2) {
      toast({
        title: "Cannot remove option",
        description: "A question must have at least 2 options",
        variant: "destructive",
      });
      return;
    }

    setQuizData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.filter((opt) => opt.id !== optionId) }
          : q,
      ),
    }));
  };

  // Update option
  const updateOption = (
    questionId: string,
    optionId: string,
    field: keyof Option,
    value: any,
  ) => {
    setQuizData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map((opt) =>
                opt.id === optionId ? { ...opt, [field]: value } : opt,
              ),
            }
          : q,
      ),
    }));
  };

  // Set correct option (only one can be correct per question)
  const setCorrectOption = (questionId: string, optionId: string) => {
    setQuizData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map((opt) => ({
                ...opt,
                isCorrect: opt.id === optionId,
              })),
            }
          : q,
      ),
    }));
  };

  // Validation
  const validateQuiz = (): boolean => {
    // Check title
    if (!quizData.title.trim()) {
      toast({
        title: "Missing title",
        description: "Please enter a quiz title",
        variant: "destructive",
      });
      return false;
    }

    // Check questions
    if (quizData.questions.length === 0) {
      toast({
        title: "No questions",
        description: "Quiz must have at least one question",
        variant: "destructive",
      });
      return false;
    }

    // Validate each question
    for (let i = 0; i < quizData.questions.length; i++) {
      const question = quizData.questions[i];
      const questionNum = i + 1;

      // Check question text
      if (!question.text.trim()) {
        toast({
          title: `Question ${questionNum} incomplete`,
          description: "Please enter question text",
          variant: "destructive",
        });
        return false;
      }

      // Check time limit
      if (question.timeLimit < 5 || question.timeLimit > 120) {
        toast({
          title: `Question ${questionNum} invalid time`,
          description: "Time limit must be between 5 and 120 seconds",
          variant: "destructive",
        });
        return false;
      }

      // Check options
      if (question.options.length < 2) {
        toast({
          title: `Question ${questionNum} needs more options`,
          description: "Each question must have at least 2 options",
          variant: "destructive",
        });
        return false;
      }

      // Check if all options have text
      const emptyOptions = question.options.filter((opt) => !opt.text.trim());
      if (emptyOptions.length > 0) {
        toast({
          title: `Question ${questionNum} has empty options`,
          description: "Please fill in all option texts",
          variant: "destructive",
        });
        return false;
      }

      // Check if there's a correct answer
      const correctOptions = question.options.filter((opt) => opt.isCorrect);
      if (correctOptions.length === 0) {
        toast({
          title: `Question ${questionNum} needs correct answer`,
          description: "Please select the correct answer",
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  // Save quiz to Supabase - SIMPLIFIED AND MORE RELIABLE VERSION
  const saveQuiz = async () => {
    console.log("Starting save process...");

    if (!validateQuiz()) {
      console.log("Validation failed");
      return;
    }

    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to save the quiz",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let savedQuizId: string;

      if (isEditing && quizId) {
        // Update existing quiz
        console.log("Updating existing quiz:", quizId);

        const { error: updateError } = await supabase
          .from("quizzes")
          .update({
            title: quizData.title.trim().substring(0, 200),
            description: quizData.description.trim().substring(0, 1000),
          })
          .eq("id", quizId.trim());

        if (updateError) {
          console.error("Update error:", updateError);
          throw updateError;
        }

        savedQuizId = quizId.trim();

        // Delete existing questions and their options
        console.log("Deleting existing questions...");
        const { error: deleteError } = await supabase
          .from("questions")
          .delete()
          .eq("quiz_id", savedQuizId);

        if (deleteError) {
          console.error("Delete error:", deleteError);
          throw deleteError;
        }
      } else {
        // Create new quiz
        console.log("Creating new quiz...");

        const quizPayload = {
          title: quizData.title.trim().substring(0, 200),
          description: quizData.description.trim().substring(0, 1000),
          user_id: user.id,
        };

        console.log("Quiz payload:", quizPayload);

        const { data: newQuiz, error: createError } = await supabase
          .from("quizzes")
          .insert(quizPayload)
          .select("id")
          .single();

        console.log("Quiz creation response:", {
          data: newQuiz,
          error: createError,
        });

        if (createError) {
          console.error("Quiz creation error:", createError);
          throw createError;
        }

        if (!newQuiz?.id) {
          throw new Error("No quiz ID returned from database");
        }

        savedQuizId = String(newQuiz.id);
        console.log("Created quiz with ID:", savedQuizId);
      }

      // Insert questions and options - SIMPLIFIED APPROACH
      console.log("Saving questions...");

      for (let i = 0; i < quizData.questions.length; i++) {
        const question = quizData.questions[i];
        console.log(`Saving question ${i + 1}/${quizData.questions.length}`);

        // Insert question
        const questionText = question.text.trim().substring(0, 1500); // Reduced limit
        const { data: questionData, error: questionError } = await supabase
          .from("questions")
          .insert({
            quiz_id: savedQuizId,
            text: questionText,
            time_limit: question.timeLimit,
          })
          .select("id")
          .single();

        if (questionError) {
          console.error(`Question ${i + 1} error:`, questionError);
          throw new Error(
            `Failed to save question ${i + 1}: ${questionError.message}`,
          );
        }

        if (!questionData?.id) {
          throw new Error(`No question ID returned for question ${i + 1}`);
        }

        console.log(`Question ${i + 1} saved with ID:`, questionData.id);

        // Insert options one by one to avoid batch issues
        console.log(
          `Saving ${question.options.length} options for question ${i + 1}`,
        );

        for (let j = 0; j < question.options.length; j++) {
          const option = question.options[j];
          const optionText = option.text.trim().substring(0, 300); // Reduced limit

          const { error: optionError } = await supabase.from("options").insert({
            question_id: String(questionData.id),
            text: optionText,
            is_correct: option.isCorrect,
          });

          if (optionError) {
            console.error(
              `Option ${j + 1} for question ${i + 1} error:`,
              optionError,
            );
            throw new Error(
              `Failed to save option ${j + 1} for question ${i + 1}: ${optionError.message}`,
            );
          }

          console.log(`Option ${j + 1} for question ${i + 1} saved`);

          // Small delay between options
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        console.log(`Completed question ${i + 1}`);

        // Delay between questions
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      console.log("All data saved successfully!");

      toast({
        title: isEditing ? "Quiz updated!" : "Quiz created!",
        description: isEditing
          ? "Your quiz has been updated successfully"
          : "Your quiz has been created successfully",
      });

      // Navigate back to host page
      setTimeout(() => {
        navigate("/host");
      }, 1500);
    } catch (error: any) {
      console.error("Save error:", error);

      let errorMessage = "Failed to save quiz";
      if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error saving quiz",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Download demo Excel template
  const downloadDemoExcel = () => {
    // Create CSV content for demo
    const csvContent = `Quiz Title,Quiz Description,Question Number,Question Text,Time Limit (seconds),Option 1,Option 2,Option 3,Option 4,Option 5,Correct Answer (1-5)
"Sample Quiz Title","This is a sample quiz description",1,"What is the capital of France?",30,"London","Berlin","Paris","Madrid","",3
"Sample Quiz Title","This is a sample quiz description",2,"Which planet is known as the Red Planet?",25,"Venus","Mars","Jupiter","Saturn","",2
"Sample Quiz Title","This is a sample quiz description",3,"What is 2 + 2?",15,"3","4","5","6","",2
"Sample Quiz Title","This is a sample quiz description",4,"Who wrote Romeo and Juliet?",35,"Charles Dickens","William Shakespeare","Jane Austen","Mark Twain","Leo Tolstoy",2`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "quiz-template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Template downloaded",
      description: "Fill out the CSV file and upload it to create your quiz",
    });
  };

  // Parse CSV content
  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.split("\n").filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = [];
      let current = "";
      let inQuotes = false;

      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      if (values.length >= headers.length) {
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || "";
        });
        rows.push(row);
      }
    }

    return rows;
  };

  // Process uploaded Excel/CSV file
  const processUploadedFile = (rows: any[]) => {
    if (rows.length === 0) {
      throw new Error("No data found in the file");
    }

    // Group rows by quiz (assuming all rows belong to same quiz)
    const firstRow = rows[0];
    const quizTitle = firstRow["Quiz Title"] || "Imported Quiz";
    const quizDescription = firstRow["Quiz Description"] || "";

    // Group questions
    const questionsMap = new Map();

    rows.forEach((row) => {
      const questionNum = parseInt(row["Question Number"]) || 1;
      const questionText = row["Question Text"] || "";
      const timeLimit = parseInt(row["Time Limit (seconds)"]) || 30;
      const correctAnswer = parseInt(row["Correct Answer (1-5)"]) || 1;

      if (!questionText.trim()) return;

      if (!questionsMap.has(questionNum)) {
        questionsMap.set(questionNum, {
          id: generateId(),
          text: questionText,
          timeLimit: Math.max(5, Math.min(120, timeLimit)),
          options: [],
        });
      }

      const question = questionsMap.get(questionNum);

      // Add options
      for (let i = 1; i <= 5; i++) {
        const optionText = row[`Option ${i}`];
        if (optionText && optionText.trim()) {
          question.options.push({
            id: generateId(),
            text: optionText.trim(),
            isCorrect: i === correctAnswer,
          });
        }
      }
    });

    // Convert to array and validate
    const questions = Array.from(questionsMap.values()).filter((q) => {
      // Ensure at least 2 options and one correct answer
      if (q.options.length < 2) return false;
      const hasCorrect = q.options.some((opt: any) => opt.isCorrect);
      if (!hasCorrect && q.options.length > 0) {
        // If no correct answer specified, make first option correct
        q.options[0].isCorrect = true;
      }
      return true;
    });

    if (questions.length === 0) {
      throw new Error("No valid questions found in the file");
    }

    return {
      title: quizTitle,
      description: quizDescription,
      questions,
    };
  };

  // Handle file upload
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const fileName = file.name.toLowerCase();
    if (
      !fileName.endsWith(".csv") &&
      !fileName.endsWith(".xlsx") &&
      !fileName.endsWith(".xls")
    ) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file",
        variant: "destructive",
      });
      return;
    }

    setUploadLoading(true);

    try {
      let csvText = "";

      if (fileName.endsWith(".csv")) {
        // Handle CSV file
        csvText = await file.text();
      } else {
        // For Excel files, we'll ask user to convert to CSV
        toast({
          title: "Excel file detected",
          description:
            "Please save your Excel file as CSV format and upload again",
          variant: "destructive",
        });
        return;
      }

      // Parse CSV
      const rows = parseCSV(csvText);
      const importedData = processUploadedFile(rows);

      // Update quiz data
      setQuizData(importedData);

      toast({
        title: "File uploaded successfully!",
        description: `Imported ${importedData.questions.length} questions`,
      });
    } catch (error: any) {
      console.error("File upload error:", error);
      toast({
        title: "Error processing file",
        description: error.message || "Failed to process the uploaded file",
        variant: "destructive",
      });
    } finally {
      setUploadLoading(false);
      // Reset file input
      event.target.value = "";
    }
  };

  // Get option colors
  const getOptionColor = (index: number): string => {
    const colors = [
      "bg-red-500",
      "bg-blue-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-teal-500",
      "bg-orange-500",
      "bg-gray-500",
    ];
    return colors[index % colors.length];
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-indigo-100 pt-16 pb-12">
        <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
          <Link to="/">
            <Logo className="h-12 w-auto ml-16" />
          </Link>
          <UserMenu />
        </div>
        <div className="max-w-4xl mx-auto px-4 mt-16">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy mx-auto mb-4"></div>
              <p className="text-gray-600">Loading quiz data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-indigo-100 pt-16 pb-12">
      <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
        <Link to="/">
          <Logo className="h-12 w-auto ml-16" />
        </Link>
        <UserMenu />
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-16">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {isEditing ? "Edit Quiz" : "Create New Quiz"}
          </h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/host")}
              disabled={loading || uploadLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={saveQuiz}
              disabled={loading || uploadLoading}
              className="bg-navy hover:bg-navy/90 gap-2"
            >
              <Save className="h-4 w-4" />
              {loading ? "Saving..." : "Save Quiz"}
            </Button>
          </div>
        </div>

        {/* Excel Upload Section */}
        <Card className="mb-8 border-2 border-dashed border-blue-300 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-blue-700 flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Quiz from Excel/CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Upload a CSV file with your quiz questions and answers. This is an
              alternative to manually creating questions.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={downloadDemoExcel}
                variant="outline"
                className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                disabled={loading || uploadLoading}
              >
                <Download className="h-4 w-4" />
                Download Template CSV
              </Button>

              <div className="relative">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={loading || uploadLoading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  id="file-upload"
                />
                <Button
                  variant="default"
                  className="bg-blue-600 hover:bg-blue-700 gap-2 w-full sm:w-auto"
                  disabled={loading || uploadLoading}
                >
                  {uploadLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload CSV File
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="text-xs text-gray-500 bg-white p-3 rounded border">
              <p className="font-medium mb-1">Instructions:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Download the template CSV file</li>
                <li>
                  Fill in your quiz title, description, questions, and answers
                </li>
                <li>Save the file as CSV format</li>
                <li>Upload the CSV file using the button above</li>
                <li>Review and edit the imported questions if needed</li>
                <li>Save your quiz</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Quiz Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quiz Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Title *
              </label>
              <Input
                id="title"
                value={quizData.title}
                onChange={(e) => updateTitle(e.target.value)}
                placeholder="Enter quiz title"
                maxLength={200}
                disabled={loading}
              />
            </div>
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Description (optional)
              </label>
              <Textarea
                id="description"
                value={quizData.description}
                onChange={(e) => updateDescription(e.target.value)}
                placeholder="Enter quiz description"
                maxLength={1000}
                rows={3}
                disabled={loading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <div className="space-y-6">
          {quizData.questions.map((question, qIndex) => (
            <Card key={question.id} className="border-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Question {qIndex + 1}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeQuestion(question.id)}
                  disabled={loading || quizData.questions.length === 1}
                  className="h-8 w-8 text-gray-500 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Question Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Question Text *
                  </label>
                  <Textarea
                    value={question.text}
                    onChange={(e) =>
                      updateQuestion(question.id, "text", e.target.value)
                    }
                    placeholder="Enter your question (can be lengthy)"
                    maxLength={2000}
                    rows={3}
                    disabled={loading}
                  />
                </div>

                {/* Time Limit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time Limit (seconds) *
                  </label>
                  <Input
                    type="number"
                    min="5"
                    max="120"
                    value={question.timeLimit}
                    onChange={(e) =>
                      updateQuestion(
                        question.id,
                        "timeLimit",
                        parseInt(e.target.value) || 30,
                      )
                    }
                    className="w-32"
                    disabled={loading}
                  />
                </div>

                {/* Options */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      Answer Options * (2-10 options)
                    </label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addOption(question.id)}
                        disabled={loading || question.options.length >= 10}
                        className="gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Add Option
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {question.options.map((option, optIndex) => (
                      <div
                        key={option.id}
                        className={`p-4 rounded-xl ${getOptionColor(optIndex)} text-white flex items-center gap-3`}
                      >
                        <input
                          type="radio"
                          name={`correct-${question.id}`}
                          checked={option.isCorrect}
                          onChange={() =>
                            setCorrectOption(question.id, option.id)
                          }
                          disabled={loading}
                          className="h-4 w-4 text-white"
                        />
                        <Textarea
                          value={option.text}
                          onChange={(e) =>
                            updateOption(
                              question.id,
                              option.id,
                              "text",
                              e.target.value,
                            )
                          }
                          placeholder={`Option ${optIndex + 1} (can be lengthy)`}
                          maxLength={500}
                          rows={2}
                          disabled={loading}
                          className="flex-1 bg-white/20 border-none text-white placeholder:text-white/60 focus:ring-white/50 resize-none"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(question.id, option.id)}
                          disabled={loading || question.options.length <= 2}
                          className="h-8 w-8 text-white hover:text-red-200 hover:bg-white/20"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500">
                    Select the radio button next to the correct answer. Options:{" "}
                    {question.options.length}/10
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add Question Button */}
          <Button
            onClick={addQuestion}
            variant="outline"
            disabled={loading}
            className="w-full py-6 border-dashed border-2 flex items-center justify-center gap-2 hover:bg-gray-50"
          >
            <PlusCircle className="h-5 w-5" />
            Add Question
          </Button>

          {/* Save Button */}
          <div className="flex justify-end pt-6">
            <Button
              onClick={saveQuiz}
              disabled={loading}
              className="bg-navy hover:bg-navy/90 gap-2 text-lg px-8 py-6 h-auto"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  {isEditing ? "Update Quiz" : "Save Quiz"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateQuiz;
