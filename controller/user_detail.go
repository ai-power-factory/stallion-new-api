package controller

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// AdminGetUserToken 管理员获取指定用户的单个令牌详情
// GET /api/user/:id/tokens/:tokenId
func AdminGetUserToken(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.SysError("failed to parse user id from URL param: " + err.Error())
		common.ApiError(c, err)
		return
	}

	tokenId, err := strconv.Atoi(c.Param("tokenId"))
	if err != nil {
		common.SysError("failed to parse token id from URL param: " + err.Error())
		common.ApiError(c, err)
		return
	}

	token, err := model.GetTokenByIds(tokenId, userId)
	if err != nil {
		common.SysError("failed to get token by ids: " + err.Error())
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, buildMaskedTokenResponse(token))
}

// AdminGetUserTokens 管理员获取指定用户的所有令牌列表（分页）
// GET /api/user/:id/tokens
// 从 URL 参数中提取 userId，支持分页查询
func AdminGetUserTokens(c *gin.Context) {
	// 从 URL 路径参数中解析用户 ID
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.SysError("failed to parse user id from URL param: " + err.Error())
		common.ApiError(c, err)
		return
	}

	// 获取分页参数
	pageInfo := common.GetPageQuery(c)

	// 查询该用户的令牌列表
	tokens, err := model.GetAllUserTokens(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.SysError("failed to get user tokens: " + err.Error())
		common.ApiError(c, err)
		return
	}

	// 查询该用户令牌总数
	total, _ := model.CountUserTokens(userId)

	// 设置分页信息并返回脱敏后的令牌数据
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(buildMaskedTokenResponses(tokens))
	common.ApiSuccess(c, pageInfo)
}

// AdminSearchUserTokens 管理员搜索指定用户的令牌
// GET /api/user/:id/tokens/search
// 支持通过关键词和令牌值进行搜索
func AdminSearchUserTokens(c *gin.Context) {
	// 从 URL 路径参数中解析用户 ID
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.SysError("failed to parse user id from URL param: " + err.Error())
		common.ApiError(c, err)
		return
	}

	// 获取搜索关键词和令牌查询参数
	keyword := c.Query("keyword")
	token := c.Query("token")

	// 获取分页参数
	pageInfo := common.GetPageQuery(c)

	// 执行搜索查询
	tokens, total, err := model.SearchUserTokens(userId, keyword, token, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.SysError("failed to search user tokens: " + err.Error())
		common.ApiError(c, err)
		return
	}

	// 设置分页信息并返回脱敏后的令牌数据
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(buildMaskedTokenResponses(tokens))
	common.ApiSuccess(c, pageInfo)
}

// AdminAddUserToken 管理员为指定用户创建新令牌
// POST /api/user/:id/tokens
// 从 URL 参数中提取 userId，绑定 JSON 请求体创建令牌
func AdminAddUserToken(c *gin.Context) {
	// 从 URL 路径参数中解析用户 ID
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.SysError("failed to parse user id from URL param: " + err.Error())
		common.ApiError(c, err)
		return
	}

	// 绑定 JSON 请求体到 Token 结构
	token := model.Token{}
	err = c.ShouldBindJSON(&token)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 校验令牌名称长度（最大 50 个字符）
	if len(token.Name) > 50 {
		common.ApiErrorI18n(c, i18n.MsgTokenNameTooLong)
		return
	}

	// 非无限额度时，检查额度值是否超出有效范围
	if !token.UnlimitedQuota {
		if token.RemainQuota < 0 {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaNegative)
			return
		}
		maxQuotaValue := int((1000000000 * common.QuotaPerUnit))
		if token.RemainQuota > maxQuotaValue {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaExceedMax, map[string]any{"Max": maxQuotaValue})
			return
		}
	}

	// 检查用户令牌数量是否已达上限
	maxTokens := operation_setting.GetMaxUserTokens()
	count, err := model.CountUserTokens(userId)
	if err != nil {
		common.SysError("failed to count user tokens: " + err.Error())
		common.ApiError(c, err)
		return
	}
	if int(count) >= maxTokens {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("已达到最大令牌数量限制 (%d)", maxTokens),
		})
		return
	}

	// 生成令牌密钥
	key, err := common.GenerateKey()
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgTokenGenerateFailed)
		common.SysLog("failed to generate token key: " + err.Error())
		return
	}

	// 创建安全的令牌对象，仅使用允许的字段
	cleanToken := model.Token{
		UserId:             userId,
		Name:               token.Name,
		Key:                key,
		CreatedTime:        common.GetTimestamp(),
		AccessedTime:       common.GetTimestamp(),
		ExpiredTime:        token.ExpiredTime,
		RemainQuota:        token.RemainQuota,
		UnlimitedQuota:     token.UnlimitedQuota,
		ModelLimitsEnabled: token.ModelLimitsEnabled,
		ModelLimits:        token.ModelLimits,
		AllowIps:           token.AllowIps,
		Group:              token.Group,
		CrossGroupRetry:    token.CrossGroupRetry,
	}

	// 插入数据库
	err = cleanToken.Insert()
	if err != nil {
		common.SysError("failed to insert token for user: " + err.Error())
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

// AdminDeleteUserTokenBatch 管理员批量删除指定用户的令牌
// POST /api/user/:id/tokens/batch
func AdminDeleteUserTokenBatch(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.SysError("failed to parse user id from URL param: " + err.Error())
		common.ApiError(c, err)
		return
	}

	tokenBatch := TokenBatch{}
	if err := c.ShouldBindJSON(&tokenBatch); err != nil || len(tokenBatch.Ids) == 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	count, err := model.BatchDeleteTokens(tokenBatch.Ids, userId)
	if err != nil {
		common.SysError("failed to batch delete user tokens: " + err.Error())
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    count,
	})
}

// AdminUpdateUserToken 管理员更新指定用户的令牌
// PUT /api/user/:id/tokens
// 支持 status_only 查询参数，仅更新状态
func AdminUpdateUserToken(c *gin.Context) {
	// 从 URL 路径参数中解析用户 ID
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.SysError("failed to parse user id from URL param: " + err.Error())
		common.ApiError(c, err)
		return
	}

	// 获取是否仅更新状态的标志
	statusOnly := c.Query("status_only")

	// 绑定 JSON 请求体到 Token 结构
	token := model.Token{}
	err = c.ShouldBindJSON(&token)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 校验令牌名称长度
	if len(token.Name) > 50 {
		common.ApiErrorI18n(c, i18n.MsgTokenNameTooLong)
		return
	}

	// 非无限额度时，检查额度值是否超出有效范围
	if !token.UnlimitedQuota {
		if token.RemainQuota < 0 {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaNegative)
			return
		}
		maxQuotaValue := int((1000000000 * common.QuotaPerUnit))
		if token.RemainQuota > maxQuotaValue {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaExceedMax, map[string]any{"Max": maxQuotaValue})
			return
		}
	}

	// 通过令牌 ID 和用户 ID 查询令牌，确保令牌属于该用户
	cleanToken, err := model.GetTokenByIds(token.Id, userId)
	if err != nil {
		common.SysError("failed to get token by ids: " + err.Error())
		common.ApiError(c, err)
		return
	}

	// 状态变更时的业务校验
	if token.Status == common.TokenStatusEnabled {
		// 已过期的令牌不允许重新启用
		if cleanToken.Status == common.TokenStatusExpired && cleanToken.ExpiredTime <= common.GetTimestamp() && cleanToken.ExpiredTime != -1 {
			common.ApiErrorI18n(c, i18n.MsgTokenExpiredCannotEnable)
			return
		}
		// 额度已用尽的令牌不允许重新启用
		if cleanToken.Status == common.TokenStatusExhausted && cleanToken.RemainQuota <= 0 && !cleanToken.UnlimitedQuota {
			common.ApiErrorI18n(c, i18n.MsgTokenExhaustedCannotEable)
			return
		}
	}

	// 根据 status_only 参数决定更新范围
	if statusOnly != "" {
		// 仅更新状态字段
		cleanToken.Status = token.Status
	} else {
		// 更新所有允许修改的字段
		cleanToken.Name = token.Name
		cleanToken.ExpiredTime = token.ExpiredTime
		cleanToken.RemainQuota = token.RemainQuota
		cleanToken.UnlimitedQuota = token.UnlimitedQuota
		cleanToken.ModelLimitsEnabled = token.ModelLimitsEnabled
		cleanToken.ModelLimits = token.ModelLimits
		cleanToken.AllowIps = token.AllowIps
		cleanToken.Group = token.Group
		cleanToken.CrossGroupRetry = token.CrossGroupRetry
	}

	// 执行更新操作
	err = cleanToken.Update()
	if err != nil {
		common.SysError("failed to update token: " + err.Error())
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    buildMaskedTokenResponse(cleanToken),
	})
}

// AdminDeleteUserToken 管理员删除指定用户的某个令牌
// DELETE /api/user/:id/tokens/:tokenId
func AdminDeleteUserToken(c *gin.Context) {
	// 从 URL 路径参数中解析用户 ID
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.SysError("failed to parse user id from URL param: " + err.Error())
		common.ApiError(c, err)
		return
	}

	// 从 URL 路径参数中解析令牌 ID
	tokenId, err := strconv.Atoi(c.Param("tokenId"))
	if err != nil {
		common.SysError("failed to parse token id from URL param: " + err.Error())
		common.ApiError(c, err)
		return
	}

	// 删除令牌，同时校验用户归属
	err = model.DeleteTokenById(tokenId, userId)
	if err != nil {
		common.SysError("failed to delete token: " + err.Error())
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

// AdminGetUserTokenKey 管理员获取指定用户令牌的完整密钥
// POST /api/user/:id/tokens/:tokenId/key
func AdminGetUserTokenKey(c *gin.Context) {
	// 从 URL 路径参数中解析用户 ID
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.SysError("failed to parse user id from URL param: " + err.Error())
		common.ApiError(c, err)
		return
	}

	// 从 URL 路径参数中解析令牌 ID
	tokenId, err := strconv.Atoi(c.Param("tokenId"))
	if err != nil {
		common.SysError("failed to parse token id from URL param: " + err.Error())
		common.ApiError(c, err)
		return
	}

	// 通过令牌 ID 和用户 ID 查询令牌
	token, err := model.GetTokenByIds(tokenId, userId)
	if err != nil {
		common.SysError("failed to get token by ids: " + err.Error())
		common.ApiError(c, err)
		return
	}

	// 返回完整密钥
	common.ApiSuccess(c, gin.H{
		"key": token.GetFullKey(),
	})
}

// AdminGetUserLogs 管理员获取指定用户的使用日志（分页）
// GET /api/user/:id/logs
// 支持多种过滤条件：类型、时间范围、令牌名、模型名、分组、请求 ID
func AdminGetUserLogs(c *gin.Context) {
	// 从 URL 路径参数中解析用户 ID
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.SysError("failed to parse user id from URL param: " + err.Error())
		common.ApiError(c, err)
		return
	}

	// 获取分页参数
	pageInfo := common.GetPageQuery(c)

	// 解析过滤条件查询参数
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	group := c.Query("group")
	requestId := c.Query("request_id")

	// 查询指定用户的日志
	logs, total, err := model.GetUserLogs(userId, logType, startTimestamp, endTimestamp, modelName, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), group, requestId)
	if err != nil {
		common.SysError("failed to get user logs: " + err.Error())
		common.ApiError(c, err)
		return
	}

	// 设置分页信息并返回
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
}
