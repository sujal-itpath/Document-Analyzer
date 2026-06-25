import requests
from sqlalchemy.orm import Session
from app.db.database import UserIntegration, GlobalJiraConfig
import json
from requests.auth import HTTPBasicAuth

class JiraService:
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id
        self.global_config = self._get_global_config()
        self.integration = self._get_integration()

    def _get_global_config(self):
        return self.db.query(GlobalJiraConfig).first()

    def _get_integration(self):
        integration = self.db.query(UserIntegration).filter(
            UserIntegration.user_id == self.user_id,
            UserIntegration.provider == "jira"
        ).first()   
        return integration

    def is_connected(self):
        if self.global_config and self.global_config.jira_api_token:
            return True
        return self.integration is not None and self.integration.access_token is not None

    def get_cloud_id(self):
        if not self.integration or not self.integration.metadata_json:
            return None
        metadata = json.loads(self.integration.metadata_json)
        return metadata.get("cloud_id")

    def _get_headers(self):
        if not self.integration or not self.integration.access_token:
            raise Exception("Jira OAuth is not connected")
        return {
            "Authorization": f"Bearer {self.integration.access_token}",
            "Accept": "application/json"
        }

    def _get_request_kwargs(self, endpoint_path: str):
        if self.global_config and self.global_config.jira_api_token:
            base_url = self.global_config.jira_base_url.rstrip('/')
            url = f"{base_url}/rest/api/2/{endpoint_path}"
            return {
                "url": url,
                "auth": HTTPBasicAuth(self.global_config.jira_email, self.global_config.jira_api_token),
                "headers": {"Accept": "application/json"}
            }
        
        cloud_id = self.get_cloud_id()
        if not cloud_id:
            raise Exception("No Jira connection found (neither global nor OAuth)")
            
        url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/2/{endpoint_path}"
        return {
            "url": url,
            "headers": self._get_headers()
        }

    def get_projects(self):
        kwargs = self._get_request_kwargs("project")
        response = requests.get(**kwargs)
        
        if not response.ok:
            raise Exception(f"Failed to fetch projects: {response.text}")
            
        return response.json()

    def get_issue_types(self, project_id_or_key: str):
        kwargs = self._get_request_kwargs(f"project/{project_id_or_key}")
        response = requests.get(**kwargs)
        
        if not response.ok:
            raise Exception(f"Failed to fetch issue types: {response.text}")
            
        project_data = response.json()
        return project_data.get("issueTypes", [])

    def create_ticket(self, project_id: str, issue_type_name: str, summary: str, description: str, acceptance_criteria: str) -> dict:
        combined_description = f"{description}\n\n*Acceptance Criteria*\n{acceptance_criteria}"
        
        payload = {
            "fields": {
                "project": {"id": project_id} if project_id.isdigit() else {"key": project_id},
                "summary": summary,
                "description": combined_description,
                "issuetype": {"name": issue_type_name}
            }
        }
        
        kwargs = self._get_request_kwargs("issue")
        response = requests.post(json=payload, **kwargs)
        
        if not response.ok:
            raise Exception(f"Failed to create ticket: {response.text}")
            
        return response.json()

    def add_comment(self, issue_id_or_key: str, comment_text: str) -> dict:
        kwargs = self._get_request_kwargs(f"issue/{issue_id_or_key}/comment")
        response = requests.post(json={"body": comment_text}, **kwargs)
        
        if not response.ok:
            raise Exception(f"Failed to add comment: {response.text}")
            
        return response.json()
