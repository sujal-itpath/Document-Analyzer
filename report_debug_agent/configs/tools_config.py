from tools.document_search import search_document
from tools.summarize_document import summarize_document
from tools.compare_documents import compare_documents
from tools.graph_search import graph_search
from tools.edit_google_doc import edit_google_doc
from tools.recall_memory import recall_memory
from tools.generate_test_cases_tool import generate_test_cases_tool
from tools.generate_jira_ticket_tool import generate_jira_ticket_tool

TOOLS = [
    search_document,
    summarize_document,
    compare_documents,
    graph_search,
    edit_google_doc,
    recall_memory,
    generate_test_cases_tool,
    generate_jira_ticket_tool,
]