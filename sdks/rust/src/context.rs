//! Context management for the Untrace SDK

use crate::error::UntraceResult;
use crate::types::{Workflow, WorkflowOptions};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use uuid::Uuid;

/// Untrace context manager
#[derive(Debug)]
pub struct UntraceContext {
    current_workflow: Arc<RwLock<Option<Workflow>>>,
}

impl UntraceContext {
    /// Create a new context manager
    pub fn new() -> Self {
        Self {
            current_workflow: Arc::new(RwLock::new(None)),
        }
    }

    /// Start a new workflow
    pub fn start_workflow(&self, name: String, run_id: String, options: WorkflowOptions) -> UntraceResult<Workflow> {
        let workflow = Workflow::new(name, run_id, options);

        // Store the current workflow
        {
            let mut current = self.current_workflow.write().unwrap();
            *current = Some(workflow.clone());
        }

        Ok(workflow)
    }

    /// Get the current workflow
    pub fn get_current_workflow(&self) -> Option<Workflow> {
        let current = self.current_workflow.read().unwrap();
        current.clone()
    }

    /// End the current workflow
    pub fn end_current_workflow(&self) -> UntraceResult<()> {
        let mut current = self.current_workflow.write().unwrap();
        *current = None;
        Ok(())
    }

    /// Set an attribute on the current workflow
    pub fn set_attribute(&self, _key: String, _value: String) -> UntraceResult<()> {
        // Note: This is a simplified implementation
        // In a real implementation, you'd need to update the workflow in place
        // or use a different data structure that allows mutation
        tracing::warn!("Setting attributes on workflows is not fully implemented yet");
        Ok(())
    }

    /// Set multiple attributes on the current workflow
    pub fn set_attributes(&self, attributes: HashMap<String, String>) -> UntraceResult<()> {
        for (key, value) in attributes {
            self.set_attribute(key, value)?;
        }
        Ok(())
    }

    /// Generate a new run ID
    pub fn generate_run_id(&self) -> String {
        Uuid::new_v4().to_string()
    }
}

impl Clone for UntraceContext {
    fn clone(&self) -> Self {
        Self {
            current_workflow: Arc::clone(&self.current_workflow),
        }
    }
}