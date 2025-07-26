package app.mannadev.meditation.data

import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.analytics.SermonEventSource
import app.mannadev.meditation.di.LocalDataSource
import app.mannadev.meditation.di.PrefsDataSource
import app.mannadev.meditation.di.RemoteDataSource
import app.mannadev.meditation.domain.repository.SermonRepository
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.Sermon
import java.time.DayOfWeek
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SermonRepositoryImpl @Inject constructor(
    @LocalDataSource private val localDataSource: SermonDataSource,
    @RemoteDataSource private val remoteDataSource: SermonDataSource,
    @PrefsDataSource private val prefsDataSource: EditableSermonDataSource
) : SermonRepository {

    /**
     * Datasource 우선순위: prefs > local > remote
     * local, remote에서 가져와야 할 경우 prefs에 저장.
     */
    override suspend fun getDisplaySermon(): Sermon? {
        return fetchAndCacheSermon(null)?.let { Sermon.fromDto(it) }

    }

    override suspend fun getDisplaySermonForDate(date: LocalDate): Sermon? {
        val targetDate = getPreviousOrCurrentSaturday(date)
        return fetchAndCacheSermon(targetDate)?.let { Sermon.fromDto(it) }
    }

    /**
     * Fetches a sermon DTO from data sources, optionally validating against a target date.
     * Caches to prefs if fetched from local or remote.
     * Datasource priority: prefs > local > remote
     */
    private suspend fun fetchAndCacheSermon(targetDate: LocalDate?): SermonDto? {
        val sources = listOf<suspend () -> SermonDto?>(
            // Source 1: Prefs
            {
                prefsDataSource.getDisplaySermonSafe()?.takeIf { dto ->
                    targetDate == null || !isSermonAfterTargetDate(dto, targetDate)
                }
            },
            // Source 2: Local
            {
                localDataSource.getDisplaySermonSafe()?.takeIf { dto ->
                    targetDate == null || !isSermonAfterTargetDate(dto, targetDate)
                }?.also { dto ->
                    prefsDataSource.saveDisplaySermonSafe(dto) // Cache to prefs
                    AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.RN_ASYNCSTORAGE)
                }
            },
//            // Source 3: Remote
//            {
//                remoteDataSource.getDisplaySermonSafe()?.also { dto ->
//                    prefsDataSource.saveDisplaySermonSafe(dto) // Cache to prefs
//                    AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.FIRESTORE)
//                }
//            }
        )

        for (sourceFetcher in sources) {
            sourceFetcher()?.let { return it }
        }
        return null
    }

    /**
     * 오늘 날짜를 기준으로 과거의 가장 최근 토요일 날짜를 반환합니다.
     */
    fun getPreviousOrCurrentSaturday(date: LocalDate): LocalDate {
        var targetDate = date
        // 오늘이 토요일이 아닌 경우, 가장 가까운 과거의 토요일로 설정
        if (date.dayOfWeek != DayOfWeek.SATURDAY) {
            targetDate = date.minusDays(date.dayOfWeek.value.toLong() % 7)
        }
        return targetDate
    }

    /**
     * 주어진 설교 날짜가 타겟 날짜 이후인지 확인합니다.
     * @param sermon 설교 DTO
     * @param targetDate 비교할 타겟 날짜
     * @return 설교 날짜가 타겟 날짜와 같거나 이후면 true, 아니면 false
     */
    fun isSermonAfterTargetDate(sermon: SermonDto, targetDate: LocalDate): Boolean {
        return !LocalDate.parse(sermon.date).isBefore(targetDate)
    }

    private suspend fun SermonDataSource.getDisplaySermonSafe(): SermonDto? {
        return runCatching { getDisplaySermon() }
            .onFailure { CrashlyticsHelper.recordException(it) }
            .getOrNull()
    }

    private suspend fun EditableSermonDataSource.saveDisplaySermonSafe(sermonDto: SermonDto) {
        runCatching { saveDisplaySermon(sermonDto) }
            .onFailure { CrashlyticsHelper.recordException(it) }
    }

}