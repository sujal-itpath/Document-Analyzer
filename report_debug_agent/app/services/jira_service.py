import requests
from sqlalchemy.orm import Session
from app.db.database import UserIntegration
import json

class JiraService:
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id
        self.integration = self._get_integration()

    def _get_integration(self):
        integration = self.db.query(UserIntegration).filter(
            UserIntegration.user_id == self.user_id,
            UserIntegration.provider == "jira"
        ).first()   
        return integration

    def is_connected(self):
        return self.integration is not None and self.integration.access_token is not None

    def get_cloud_id(self):
        if not self.is_connected() or not self.integration.metadata_json:
            return None
        metadata = json.loads(self.integration.metadata_json)
        return metadata.get("cloud_id")

    def _get_headers(self):
        if not self.is_connected():
            raise Exception("Jira is not connected")
        return {
            "Authorization": f"Bearer {self.integration.access_token}",
            "Accept": "application/json"
        }

    def get_projects(self):
        cloud_id = self.get_cloud_id()
        if not cloud_id:
            raise Exception("No Jira cloud ID found")
            
        url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/project"
        response = requests.get(url, headers=self._get_headers())
        
        if not response.ok:
            raise Exception(f"Failed to fetch projects: {response.text}")
            
        return response.json()

    def get_issue_types(self, project_id_or_key: str):
        cloud_id = self.get_cloud_id()
        if not cloud_id:
            raise Exception("No Jira cloud ID found")
            
        url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/project/{project_id_or_key}"
        response = requests.get(url, headers=self._get_headers())
        
        if not response.ok:
            raise Exception(f"Failed to fetch issue types: {response.text}")
            
        project_data = response.json()
        return project_data.get("issueTypes", [])

    def create_ticket(self, project_id: str, issue_type_name: str, summary: str, description: str, acceptance_criteria: str) -> dict:
        cloud_id = self.get_cloud_id()
        if not cloud_id:
            raise Exception("No Jira cloud ID found")
            
        # Format description to Atlassian Document Format (ADF)
        # For simplicity, we use text blocks.
        adf_description = {
            "version": 1,
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": description}]
                },
                {
                    "type": "heading",
                    "attrs": {"level": 3},
                    "content": [{"type": "text", "text": "Acceptance Criteria"}]
                },
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": acceptance_criteria}]
                }
            ]
        }
        
        payload = {
            "fields": {
                "project": {"id": project_id},
                "summary": summary,
                "description": adf_description,
                "issuetype": {"name": issue_type_name}
            }
        }
        
        url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/issue"
        response = requests.post(url, headers=self._get_headers(), json=payload)
        
        if not response.ok:
            raise Exception(f"Failed to create ticket: {response.text}")
            
        return response.json()

    def add_comment(self, issue_id_or_key: str, comment_text: str) -> dict:
        cloud_id = self.get_cloud_id()
        if not cloud_id:
            raise Exception("No Jira cloud ID found")
            
        adf_comment = {
            "version": 1,
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": comment_text}]
                }
            ]
        }
        
        url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/issue/{issue_id_or_key}/comment"
        response = requests.post(url, headers=self._get_headers(), json={"body": adf_comment})
        
        if not response.ok:
            raise Exception(f"Failed to add comment: {response.text}")
            
        return response.json()
