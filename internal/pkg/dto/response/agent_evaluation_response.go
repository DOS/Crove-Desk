package response

type AgentEvaluationResultResponse struct {
	CaseID      string `json:"caseId"`
	Category    string `json:"category"`
	EngineCode  string `json:"engineCode"`
	Passed      bool   `json:"passed"`
	ReplyText   string `json:"replyText"`
	Interrupted bool   `json:"interrupted"`
	Error       string `json:"error,omitempty"`
	Finding     string `json:"finding,omitempty"`
}

type AgentEvaluationReportResponse struct {
	EngineCode string                          `json:"engineCode"`
	Total      int                             `json:"total"`
	Passed     int                             `json:"passed"`
	Results    []AgentEvaluationResultResponse `json:"results"`
	CSV        string                          `json:"csv"`
}
